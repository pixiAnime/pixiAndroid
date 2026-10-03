/**
 * PixiSandbox — the TypeScript side of the native QuickJS extension sandbox.
 *
 * Responsibilities:
 *  - own the `DeviceEventEmitter` bridge events (`PixiSandbox:hostRequest`,
 *    `PixiSandbox:log`) and route them to whichever sandbox context raised
 *    them — one JSRuntime per extension, so `contextId` is the key;
 *  - expose create / evaluate / call / dispose as envelope-producing helpers,
 *    letting `ExtensionSandbox` map envelopes onto `ExtensionError`s;
 *  - guarantee that a missing handler or a malformed payload answers the
 *    sandbox instead of leaving its promise dangling forever.
 *
 * Nothing here talks to sockets: the shared HTTP policy layer (`http.ts`)
 * owns headers, timeouts and response limits — the sandbox only ever sees the
 * plain text result.
 */
import { DeviceEventEmitter } from 'react-native'

import { pixiSandboxModule, runNative } from './native'
import { buildEntryScript, buildRuntimeScript } from './sandboxScripts'
import type {
  ExtensionHttpRequest,
  HostLogEvent,
  HostRequestEvent,
  SandboxHttpHandler,
  SandboxEnvelope,
} from './types'

export const HOST_REQUEST_EVENT = 'PixiSandbox:hostRequest'
export const HOST_LOG_EVENT = 'PixiSandbox:log'

type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error'

export interface SandboxHandlers {
  /** Required: the shared HTTP policy layer for this extension. */
  http: SandboxHttpHandler
  /** Optional: `console.*` output from inside the sandbox. */
  onLog?: (level: LogLevel, message: string) => void
}

interface Registration {
  handlers: SandboxHandlers
}

const registry = new Map<string, Registration>()
let listening = false

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function respond(
  contextId: string,
  requestId: number,
  ok: boolean,
  payload: unknown,
): void {
  try {
    pixiSandboxModule().resolveHttp(contextId, requestId, ok, JSON.stringify(payload))
  } catch {
    // The sandbox is already gone — there is nobody left to answer.
  }
}

function errorCodeOf(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.length > 0) return code
  }
  return fallback
}

function errorMessageOf(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim().slice(0, 300)
    }
  }
  return fallback
}

/* ------------------------------------------------------------------ */
/* Event routing                                                       */
/* ------------------------------------------------------------------ */

function onHostRequest(raw: unknown): void {
  const event = raw as HostRequestEvent | null
  if (!event || typeof event.contextId !== 'string' || typeof event.requestId !== 'number') return

  const registration = registry.get(event.contextId)
  if (!registration) {
    respond(event.contextId, event.requestId, false, {
      code: 'EXTENSION_NOT_FOUND',
      message: 'The extension is no longer available.',
    })
    return
  }

  let request: ExtensionHttpRequest
  try {
    const parsed: unknown = JSON.parse(event.json)
    if (!parsed || typeof parsed !== 'object' || typeof (parsed as { url?: unknown }).url !== 'string') {
      throw new Error('malformed')
    }
    request = parsed as ExtensionHttpRequest
  } catch {
    respond(event.contextId, event.requestId, false, {
      code: 'EXTENSION_ERROR',
      message: 'The request could not be read.',
    })
    return
  }

  const { contextId, requestId } = event
  Promise.resolve()
    .then(() => registration.handlers.http(request))
    .then(
      (response) =>
        respond(contextId, requestId, true, {
          status: typeof response?.status === 'number' ? response.status : 0,
          headers: response?.headers ?? {},
          text: typeof response?.text === 'string' ? response.text : '',
        }),
      (error) =>
        respond(contextId, requestId, false, {
          code: errorCodeOf(error, 'HTTP_ERROR'),
          message: errorMessageOf(error, 'Request failed.'),
        }),
    )
}

function onHostLog(raw: unknown): void {
  const event = raw as HostLogEvent | null
  if (!event || typeof event.contextId !== 'string') return
  const registration = registry.get(event.contextId)
  if (!registration?.handlers.onLog) return
  const level: LogLevel =
    event.level === 'debug' || event.level === 'info' || event.level === 'warn' || event.level === 'error'
      ? event.level
      : 'log'
  registration.handlers.onLog(level, typeof event.message === 'string' ? event.message : '')
}

function ensureListening(): void {
  if (listening) return
  listening = true
  DeviceEventEmitter.addListener(HOST_REQUEST_EVENT, onHostRequest)
  DeviceEventEmitter.addListener(HOST_LOG_EVENT, onHostLog)
}

/* ------------------------------------------------------------------ */
/* Public API used by ExtensionSandbox                                 */
/* ------------------------------------------------------------------ */

/** Route this context's HTTP + log events to `handlers`. */
export function registerSandbox(contextId: string, handlers: SandboxHandlers): void {
  ensureListening()
  registry.set(contextId, { handlers })
}

/** Stop routing events and destroy the native JSRuntime for `contextId`. */
export function unregisterSandbox(contextId: string): void {
  registry.delete(contextId)
  try {
    pixiSandboxModule().dispose(contextId)
  } catch {
    // Never linked — nothing to tear down.
  }
}

/** Create the JSRuntime. Resolves with an envelope. */
export function createSandbox(contextId: string): Promise<SandboxEnvelope> {
  ensureListening()
  return runNative((module) => module.create(contextId))
}

/**
 * Evaluate the bootstrap then the entry module. Resolves with a boot envelope
 * (`{ok:true, manifest, methods}`) or a validation error envelope.
 */
export function evaluateSandbox(contextId: string, moduleSource: string): Promise<SandboxEnvelope> {
  return runNative((module) =>
    module.evaluate(
      contextId,
      buildRuntimeScript(),
      buildEntryScript(),
      moduleSource,
    ),
  )
}

/** Run one extension method under a host-enforced deadline. */
export function callSandbox(
  contextId: string,
  method: string,
  args: unknown,
  timeoutMs: number,
): Promise<SandboxEnvelope> {
  return runNative((module) => module.call(contextId, method, JSON.stringify(args ?? null), timeoutMs))
}

/** Dispose the runtime and stop routing its events. */
export function disposeSandbox(contextId: string): void {
  unregisterSandbox(contextId)
}

/** Number of registered sandboxes — used by the extensions screen. */
export function activeSandboxCount(): number {
  return registry.size
}
