/**
 * AniList GraphQL client (mobile) — the automatic fallback source when
 * Jikan/MAL is unavailable (see src/api/fallback.ts).
 *
 * - POST {baseUrl} with JSON {query, variables} — no auth required;
 * - 2 attempts: 429 → +3s, 5xx/network/timeout → +1s; other 4xx fail fast;
 * - GraphQL errors come back HTTP 200 — classified via `errors[].status`;
 * - throws ApiError — the same taxonomy as the Jikan client.
 */
import { config } from '@/config'
import { ApiError } from '@/api/errors'
import type { ALErrorPayload } from './types'

const MAX_ATTEMPTS = 2
const TIMEOUT_MS = 12_000

let callSeq = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Abort detection without `DOMException`, which Hermes does not expose. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

interface Outcome {
  res?: Response
  reason: 'ok' | 'aborted' | 'timeout' | 'network'
}

/** POST with a hard timeout layered over the caller's abort signal. */
async function postWithDeadline(body: string, signal?: AbortSignal): Promise<Outcome> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer)
      return { reason: 'aborted' }
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  try {
    const res = await fetch(config.anilist.baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
      signal: ctrl.signal,
    })
    return { res, reason: 'ok' }
  } catch (error) {
    if (signal?.aborted) return { reason: 'aborted' }
    if (isAbortError(error) && !timedOut && signal?.aborted) return { reason: 'aborted' }
    return { reason: timedOut ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Execute a GraphQL document. Resolves with `data` (callers destructure
 * `.Page` / `.Media`), throws ApiError otherwise — never a raw fetch error.
 */
export async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<T> {
  const callId = ++callSeq
  const body = JSON.stringify({ query, variables })
  // Dev-only ladder tracing (production strips the branch).
  const dbg = __DEV__
    ? (msg: string) => console.debug(`[anilist#${callId}] ${msg}`)
    : (_msg: string) => {}

  dbg(`CALL ${Object.keys(variables).join(',')}`)
  let lastError: ApiError = new ApiError('network', 'Could not reach the anime API')

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled')

    const { res, reason } = await postWithDeadline(body, signal)
    if (reason === 'aborted') throw new ApiError('aborted', 'Request cancelled')
    if (reason === 'timeout' || reason === 'network') {
      dbg(`${reason.toUpperCase()} attempt=${attempt}`)
      lastError = new ApiError('network', 'Could not reach the anime API')
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1_000)
        continue
      }
      throw lastError
    }
    if (!res) throw new ApiError('unexpected', 'The anime API returned no response')

    if (res.ok) {
      let payload: ALErrorPayload & { data?: T }
      try {
        payload = (await res.json()) as ALErrorPayload & { data?: T }
      } catch {
        throw new ApiError('unexpected', 'The anime API returned an unreadable response')
      }
      const first = payload.errors?.[0]
      if (first && payload.data == null) {
        const status = first.status ?? 0
        if (__DEV__) console.debug(`[anilist#${callId}] GQL ${status} ${first.message}`)
        if (status === 400) throw new ApiError('bad-request', 'Invalid request', 400)
        if (status === 404 || first.extensions?.code === 'NOT_FOUND') {
          throw new ApiError('not-found', 'Not found', 404)
        }
        throw new ApiError('server', 'The anime API is having trouble', status || undefined)
      }
      dbg('OK')
      return payload.data as T
    }

    if (res.status === 429) {
      dbg('429')
      lastError = new ApiError('rate-limited', 'Too many requests — please slow down', 429)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(3_000)
        continue
      }
      throw lastError
    }
    if (res.status >= 500) {
      dbg(`5xx ${res.status}`)
      lastError = new ApiError('server', 'The anime API is having trouble', res.status)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1_000)
        continue
      }
      throw lastError
    }
    throw new ApiError('unexpected', `Unexpected response (${res.status})`, res.status)
  }

  dbg(`THROW ${lastError.kind}`)
  throw lastError
}
