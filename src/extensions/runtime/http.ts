/**
 * Extension HTTP policy layer — every extension network request funnels
 * through here (spec §10/§25) and this is the only place that turns one into
 * a real socket.
 *
 * Unlike the web build, there is no bridge to route through: Android has no
 * CORS layer, so `fetch` itself may send the extension's headers (`Referer`,
 * `User-Agent`, `Cookie`, …) straight upstream. That collapses the web's two
 * bridge forms (query vs JSON) into a single path — while every *policy*
 * decision (URL validation, header/body sanitation, size caps, host-side
 * deadline) is unchanged, because it all comes from the shared `policy.ts`.
 *
 * Errors are always structured and friendly; `PIXICLIENT_UNAVAILABLE` /
 * `PIXICLIENT_ERROR` are unreachable here (the enum keeps them for
 * compatibility with the shared error taxonomy).
 */
import { HTTP_TIMEOUT_MS } from './config.ts'
import { ExtensionError } from './errors.ts'
import { POLICY, buildTargetUrl, sanitizeBody, sanitizeHeaders } from './policy.ts'
import type { ExtensionHttpRequest, PlainHttpResponse } from './ExtensionSandbox.ts'

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

function clampTimeout(requested: number | null | undefined): number {
  const value = typeof requested === 'number' && Number.isFinite(requested) ? requested : HTTP_TIMEOUT_MS
  return Math.max(1_000, Math.min(value, HTTP_TIMEOUT_MS))
}

/** Abort detection without `DOMException`, which Hermes does not expose. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

export async function extensionRequest(req: ExtensionHttpRequest): Promise<PlainHttpResponse> {
  const target = buildTargetUrl(req.url, req.query ?? null)
  const headers = sanitizeHeaders(req.headers)
  const body = sanitizeBody(req.body)
  const method = ALLOWED_METHODS.has(String(req.method).toUpperCase())
    ? String(req.method).toUpperCase()
    : 'GET'
  const contentType =
    typeof req.contentType === 'string' && req.contentType.length > 0
      ? req.contentType.slice(0, 100)
      : undefined
  const sendBody = method !== 'GET' && method !== 'HEAD'

  const controller = new AbortController()
  const timeoutMs = clampTimeout(req.timeoutMs)
  // Host-side deadline for EVERY path (spec §28) — nothing hangs past the
  // configured limit even if the native stack ignores the abort signal.
  let timer: ReturnType<typeof setTimeout> | null = null
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new ExtensionError('HTTP_TIMEOUT', 'The request took too long and was cancelled.'))
    }, timeoutMs)
  })

  const operation = (async (): Promise<PlainHttpResponse> => {
    const requestHeaders: Record<string, string> = { Accept: '*/*', ...(headers ?? {}) }
    if (contentType) requestHeaders['Content-Type'] = contentType

    const res = await fetch(target, {
      method,
      headers: requestHeaders,
      ...(sendBody && body !== null ? { body } : {}),
      signal: controller.signal,
    })

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > POLICY.maxHttpResponseChars) {
      throw new ExtensionError('HTTP_ERROR', 'The response was too large to process.')
    }
    const text = await res.text()
    if (text.length > POLICY.maxHttpResponseChars) {
      throw new ExtensionError('HTTP_ERROR', 'The response was too large to process.')
    }

    const outHeaders: Record<string, string> = {}
    res.headers.forEach((value, name) => {
      if (Object.keys(outHeaders).length < POLICY.maxHeaders) {
        outHeaders[name] = value.slice(0, POLICY.maxHeaderValue)
      }
    })
    return { status: res.status, headers: outHeaders, text }
  })()

  try {
    // Promise.race attaches handlers to both — the loser settling later stays
    // "handled", so no unhandled-rejection noise from the abandoned attempt.
    return await Promise.race([operation, deadline])
  } catch (err) {
    if (err instanceof ExtensionError) throw err

    if (controller.signal.aborted || isAbortError(err)) {
      throw new ExtensionError('HTTP_TIMEOUT', 'The request took too long and was cancelled.')
    }
    throw new ExtensionError('HTTP_ERROR', 'The request could not be completed.')
  } finally {
    if (timer) clearTimeout(timer)
  }
}
