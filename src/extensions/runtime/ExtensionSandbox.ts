/**
 * ExtensionSandbox — the native QuickJS runtime behind the extension pool.
 *
 * Same contract as the web's iframe sandbox (`start` / `call` / `dispose` /
 * `isDisposed`, host-enforced deadlines that recycle a wedged context), but
 * the browser frame is replaced by a dedicated JSRuntime compiled into the
 * app: no DOM, no storage, no shared state, and `context.http` is an RPC to
 * the shared policy layer instead of a frame-initiated fetch.
 *
 * Lifecycle:
 *  start()   → native create + evaluate the bootstrap and entry scripts,
 *              then read `{ manifest, methods }` (once, cached);
 *  call()    → native call with a HOST-side deadline; a timeout disposes the
 *              context so a wedged/infinite-loop extension can never stall
 *              the app or other extensions (spec §27/§28);
 *  dispose() → release the runtime, reject pending work, notify the pool.
 *
 * The extension source is handed to the engine as a module body — it is never
 * interpolated into a string, so arbitrary extension text cannot escape the
 * sandbox.
 */
import { BOOT_TIMEOUT_MS } from './config.ts'
import { ExtensionError, isExtensionErrorCode, toStructuredExtensionError } from './errors.ts'
import {
  callSandbox,
  createSandbox,
  disposeSandbox,
  evaluateSandbox,
  registerSandbox,
} from '@/platform/quickjs/PixiSandbox.ts'
import type { SandboxEnvelope } from '@/platform/quickjs/types.ts'

export type {
  ExtensionHttpRequest,
  PlainHttpResponse,
  SandboxBootInfo,
  SandboxHttpHandler,
  SandboxMethods,
} from '@/platform/quickjs/types.ts'

import type {
  SandboxBootInfo,
  SandboxHttpHandler,
  SandboxMethods,
} from '@/platform/quickjs/types.ts'

type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error'

type DisposeCause = { code: 'EXTENSION_ERROR' | 'EXTENSION_TIMEOUT'; message: string }

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

interface PendingBoot {
  resolve: (info: SandboxBootInfo) => void
  reject: (error: unknown) => void
}

function asMethods(raw: unknown): SandboxMethods {
  const m = (raw ?? {}) as Partial<SandboxMethods>
  return { getSources: m.getSources === true, getSubtitles: m.getSubtitles === true }
}

export class ExtensionSandbox {
  private readonly source: string
  private readonly extensionId: string
  private readonly httpHandler: SandboxHttpHandler
  private readonly onDead?: () => void

  private bootPromise: Promise<SandboxBootInfo> | null = null
  private boot: PendingBoot | null = null
  private bootTimer: ReturnType<typeof setTimeout> | null = null
  private pendingCalls = new Map<number, PendingCall>()
  private seq = 0
  private disposed = false

  constructor(
    source: string,
    extensionId: string,
    httpHandler: SandboxHttpHandler,
    onDead?: () => void,
  ) {
    this.source = source
    this.extensionId = extensionId
    this.httpHandler = httpHandler
    this.onDead = onDead
  }

  /** Boot the native runtime and read its manifest (once). */
  start(): Promise<SandboxBootInfo> {
    if (this.disposed) {
      return Promise.reject(
        new ExtensionError('EXTENSION_NOT_FOUND', 'The extension is no longer available.', this.extensionId),
      )
    }
    if (this.bootPromise) return this.bootPromise

    this.bootPromise = new Promise<SandboxBootInfo>((resolve, reject) => {
      this.boot = { resolve, reject }
    })
    this.runBoot().catch(() => {
      /* every failure path settles the boot promise itself */
    })
    return this.bootPromise
  }

  /** Run one extension method under a host-enforced deadline. */
  async call(
    method: 'getSources' | 'getSubtitles',
    args: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    await this.start()
    if (this.disposed) {
      throw new ExtensionError('EXTENSION_NOT_FOUND', 'The extension is no longer available.', this.extensionId)
    }

    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(id)
        reject(
          new ExtensionError('EXTENSION_TIMEOUT', 'The extension took too long to respond.', this.extensionId),
        )
        // Recycle the wedged runtime — the next call boots a fresh one.
        // The cause is forwarded so OTHER calls in flight on this runtime
        // report the same honest reason instead of a generic reload note.
        this.dispose({ code: 'EXTENSION_TIMEOUT', message: 'The extension took too long to respond.' })
      }, timeoutMs)
      this.pendingCalls.set(id, { resolve, reject, timer })
      this.invoke(id, method, args, timeoutMs).catch(() => {
        /* invoke() never throws — it settles the pending call */
      })
    })
  }

  /**
   * Tear down the runtime and reject pending work. `cause` lets the timeout
   * path report its reason to calls that were in flight alongside it.
   */
  dispose(cause?: DisposeCause): void {
    if (this.disposed) return
    this.disposed = true

    if (this.bootTimer) {
      clearTimeout(this.bootTimer)
      this.bootTimer = null
    }
    for (const pending of this.pendingCalls.values()) {
      clearTimeout(pending.timer)
      pending.reject(
        new ExtensionError(
          cause?.code ?? 'EXTENSION_ERROR',
          cause?.message ?? 'The extension was reloaded.',
          this.extensionId,
        ),
      )
    }
    this.pendingCalls.clear()

    if (this.boot) {
      this.boot.reject(
        new ExtensionError('EXTENSION_NOT_FOUND', 'The extension is no longer available.', this.extensionId),
      )
      this.boot = null
    }

    disposeSandbox(this.extensionId)
    this.onDead?.()
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /* ------------------------- internals ------------------------- */

  private async runBoot(): Promise<void> {
    const timer = setTimeout(() => {
      this.failBoot('EXTENSION_TIMEOUT', 'The extension took too long to load.')
    }, BOOT_TIMEOUT_MS)
    this.bootTimer = timer

    try {
      // Register before anything can raise an event for this context.
      registerSandbox(this.extensionId, {
        http: this.httpHandler,
        onLog: (level, message) => this.log(level, message),
      })

      const created = await createSandbox(this.extensionId)
      if (this.disposed) return
      if (!created.ok) {
        this.failBoot(created.err.code, created.err.message)
        return
      }

      const evaluated = await evaluateSandbox(this.extensionId, this.source)
      if (this.disposed) return
      if (!evaluated.ok) {
        this.failBoot(evaluated.err.code, evaluated.err.message)
        return
      }

      this.settleBoot({ manifest: evaluated.manifest, methods: asMethods(evaluated.methods) })
    } catch (error) {
      if (this.disposed) return
      const structured = toStructuredExtensionError(error, this.extensionId)
      this.failBoot(structured.code, structured.message)
    } finally {
      if (this.bootTimer === timer) {
        clearTimeout(timer)
        this.bootTimer = null
      }
    }
  }

  private settleBoot(info: SandboxBootInfo): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer)
      this.bootTimer = null
    }
    const pending = this.boot
    this.boot = null
    pending?.resolve(info)
  }

  private failBoot(code: string, message: string): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer)
      this.bootTimer = null
    }
    const pending = this.boot
    this.boot = null
    if (!pending) return // boot already settled — nothing left to fail

    pending.reject(
      new ExtensionError(
        isExtensionErrorCode(code) ? code : 'VALIDATION_FAILED',
        message.slice(0, 300) || 'The extension could not be loaded.',
        this.extensionId,
      ),
    )
    this.dispose()
  }

  private async invoke(
    id: number,
    method: 'getSources' | 'getSubtitles',
    args: unknown,
    timeoutMs: number,
  ): Promise<void> {
    let envelope: SandboxEnvelope
    try {
      envelope = await callSandbox(this.extensionId, method, args, timeoutMs)
    } catch (error) {
      const structured = toStructuredExtensionError(error, this.extensionId)
      this.finishCall(id, false, new ExtensionError(structured.code, structured.message, this.extensionId))
      return
    }

    if (this.disposed) return

    if (envelope.ok) {
      this.finishCall(id, true, envelope.value)
      return
    }

    const code = isExtensionErrorCode(envelope.err.code) ? envelope.err.code : 'EXTENSION_ERROR'
    const message = envelope.err.message.slice(0, 300) || 'The extension failed while processing the request.'
    this.finishCall(id, false, new ExtensionError(code, message, this.extensionId))

    // The native runtime may already have been recycled underneath us (it
    // enforces its own deadline). Drop this sandbox so the pool boots a fresh
    // one on the next request — exactly what frame disposal does on the web.
    if (code === 'EXTENSION_TIMEOUT') {
      this.dispose({ code: 'EXTENSION_TIMEOUT', message })
    } else if (code === 'EXTENSION_NOT_FOUND') {
      this.dispose({ code: 'EXTENSION_ERROR', message })
    }
  }

  private finishCall(id: number, ok: boolean, result: unknown): void {
    const pending = this.pendingCalls.get(id)
    if (!pending) return
    this.pendingCalls.delete(id)
    clearTimeout(pending.timer)
    if (ok) pending.resolve(result)
    else pending.reject(result as unknown)
  }

  /** `console.*` from inside the sandbox, prefixed the way the web frame is. */
  private log(level: LogLevel, message: string): void {
    try {
      const printer = console[level] ?? console.log
      printer.call(console, `[ext:${this.extensionId}]`, message)
    } catch {
      /* logging must never break the sandbox */
    }
  }
}
