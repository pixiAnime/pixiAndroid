/**
 * Wire types for the native QuickJS extension sandbox.
 *
 * These are the shapes exchanged across the JNI boundary:
 *  - `ExtensionHttpRequest` / `PlainHttpResponse` — the same contract the web
 *    iframe sandbox uses, so the shared `policy.ts` layer is untouched;
 *  - the `Sandbox*Envelope`s — the single JSON envelope every native call
 *    resolves with (`{ok:true,...}` on success, `{ok:false,err:{code,message}}`
 *    on failure), which keeps success and failure on one promise path;
 *  - the `DeviceEventEmitter` payloads the sandbox pushes back to JS.
 *
 * Kept in `platform/` (not in `extensions/`) so the platform layer never
 * imports application code; `extensions/runtime/ExtensionSandbox.ts` re-exports
 * the request/response types under the names the shared runtime expects.
 */

/** A request the sandbox wants the host policy layer to perform. */
export interface ExtensionHttpRequest {
  url: string
  method: string
  headers?: Record<string, string> | null
  query?: Record<string, unknown> | null
  body?: unknown
  contentType?: string | null
  timeoutMs?: number | null
}

/** The plain, non-streamed response the sandbox receives. */
export interface PlainHttpResponse {
  status: number
  headers: Record<string, string>
  text: string
}

/** `(req) => Promise<res>` — implemented by the shared HTTP policy layer. */
export type SandboxHttpHandler = (req: ExtensionHttpRequest) => Promise<PlainHttpResponse>

/** Which methods the extension actually implements. */
export interface SandboxMethods {
  getSources: boolean
  getSubtitles: boolean
}

/** Result of a successful `evaluate` — the parsed extension manifest. */
export interface SandboxBootInfo {
  manifest: unknown
  methods: SandboxMethods
}

/** Success envelope: a boot result (`manifest`+`methods`) or a call `value`. */
export interface SandboxOkEnvelope {
  ok: true
  manifest?: unknown
  methods?: SandboxMethods
  value?: unknown
}

/** Failure envelope — always carries a stable `code` + friendly `message`. */
export interface SandboxErrEnvelope {
  ok: false
  err: { code: string; message: string }
}

export type SandboxEnvelope = SandboxOkEnvelope | SandboxErrEnvelope

/** `PixiSandbox:hostRequest` event payload. */
export interface HostRequestEvent {
  contextId: string
  requestId: number
  json: string
}

/** `PixiSandbox:log` event payload (`console.*` from inside the sandbox). */
export interface HostLogEvent {
  contextId: string
  level: string
  message: string
}

/**
 * Coerce an unknown value into an envelope.
 *
 * The native side already guarantees valid JSON for anything it produces, but
 * a corrupt payload must never throw into the caller — it degrades to a
 * well-formed error instead.
 */
export function parseEnvelope(raw: unknown): SandboxEnvelope {
  if (typeof raw !== 'string' || raw.length === 0) {
    return {
      ok: false,
      err: { code: 'EXTENSION_ERROR', message: 'The sandbox returned an unreadable response.' },
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      ok: false,
      err: { code: 'EXTENSION_ERROR', message: 'The sandbox returned an unreadable response.' },
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      err: { code: 'EXTENSION_ERROR', message: 'The sandbox returned an unreadable response.' },
    }
  }

  const candidate = parsed as Partial<SandboxOkEnvelope> & Partial<SandboxErrEnvelope>
  if (candidate.ok === true) {
    return { ok: true, manifest: candidate.manifest, methods: candidate.methods, value: candidate.value }
  }
  const err = candidate.err
  if (err && typeof err === 'object' && typeof err.code === 'string') {
    return {
      ok: false,
      err: { code: err.code, message: typeof err.message === 'string' ? err.message : 'The extension failed.' },
    }
  }
  return { ok: false, err: { code: 'EXTENSION_ERROR', message: 'The extension failed.' } }
}
