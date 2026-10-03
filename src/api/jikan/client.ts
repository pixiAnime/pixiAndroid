/**
 * Jikan v4 HTTP client (mobile).
 *
 * - single place that builds Jikan URLs (base URL from config);
 * - rate-limit aware: a global scheduler spaces every request 400ms apart
 *   (~2.5 req/s vs Jikan's 3 req/s), 429 → queue-wide cool-down + 2s
 *   backoff, 5xx/network → 1s, max 2 attempts — after that the AniList
 *   fallback (src/api/fallback.ts) takes over; other 4xx fail fast;
 * - **every request is cut at 6s** (src/api/deadline.ts) and a timeout goes
 *   straight to the fallback instead of buying a second attempt: RN's fetch
 *   has no deadline of its own, and 2 x OkHttp's ~12s window is what left a
 *   cold start sitting on "Connecting…" while AniList could have answered in
 *   0.4s (see that module for the measurement);
 * - errors are ApiError (src/api/errors.ts) — shared with the fallback;
 * - cancellation (StrictMode remount / navigation) throws ApiError('aborted')
 *   immediately — never backs off, never retries.
 *
 * Always a direct `fetch`: the Android network stack has no CORS layer to
 * work around, so the pixiClient bridge the web build optionally routes
 * through (config.jikan.forceBridge) has no counterpart here.
 */
import { config } from '@/config'
import { ApiError } from '@/api/errors'
import { fetchWithDeadline } from '@/api/deadline'

export type JikanQuery = Record<string, string | number | boolean | undefined | null>

const MAX_ATTEMPTS = 2
const RETRYABLE_WAIT_MS = 1_000
/** ~2.5 req/s global spacing — Jikan allows 3 req/s, bursts of 60/min. */
const MIN_REQUEST_INTERVAL_MS = 400
/** Backoff ladder honored when Jikan answers 429 (beyond per-attempt sleep). */
const RATE_LIMIT_BACKOFF_MS = [2_000, 4_000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Abort detection without `DOMException`, which Hermes does not expose —
 * fetch polyfills throw an `Error` whose `name` is `AbortError`.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Global request scheduler: every Jikan request starts at least
 * MIN_REQUEST_INTERVAL_MS apart, so N parallel queries can't stampede
 * into 429s. Slots are a real queue — a waiter cancelled before its
 * start (StrictMode remount, navigation) releases its slot immediately,
 * so the replacement fetch isn't delayed behind a dead reservation.
 */
interface Slot {
  startAt: number
  signal?: AbortSignal
  resolve: () => void
  reject: (err: unknown) => void
  timer: ReturnType<typeof setTimeout> | null
  onAbort: (() => void) | null
}

let callSeq = 0
const pending: Slot[] = []
let lastDispatchAt = 0
/** Queue-wide 429 cool-down: no slot may start before this time. */
let cooldownUntil = 0

/** Remove a slot from the queue (returns false if it was already gone). */
function detach(slot: Slot): boolean {
  const i = pending.indexOf(slot)
  if (i === -1) return false
  pending.splice(i, 1)
  if (slot.timer !== null) {
    clearTimeout(slot.timer)
    slot.timer = null
  }
  if (slot.onAbort && slot.signal) {
    slot.signal.removeEventListener('abort', slot.onAbort)
  }
  return true
}

/** Recompute start times: first waiter ASAP (>= last dispatch + interval), the rest spaced. */
function relayout(): void {
  const now = Date.now()
  let at = Math.max(lastDispatchAt + MIN_REQUEST_INTERVAL_MS, cooldownUntil, now)
  for (const slot of pending) {
    slot.startAt = at
    at += MIN_REQUEST_INTERVAL_MS
    if (slot.timer !== null) clearTimeout(slot.timer)
    slot.timer = setTimeout(() => dispatchSlot(slot), Math.max(0, slot.startAt - Date.now()))
  }
}

function dispatchSlot(slot: Slot): void {
  if (!detach(slot)) return // cancelled in the meantime
  lastDispatchAt = Date.now()
  slot.resolve()
  relayout() // remaining waiters may start earlier now (and must respect real spacing)
}

/** Reserve the next start slot; rejects immediately if `signal` aborts while queued. */
function acquireSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new ApiError('aborted', 'Request cancelled'))
  }
  return new Promise<void>((resolve, reject) => {
    const slot: Slot = { startAt: 0, signal, resolve, reject, timer: null, onAbort: null }
    if (signal) {
      slot.onAbort = () => {
        if (detach(slot)) relayout()
        reject(new ApiError('aborted', 'Request cancelled'))
      }
      signal.addEventListener('abort', slot.onAbort, { once: true })
    }
    pending.push(slot)
    relayout()
  })
}

export function buildJikanUrl(path: string, query: JikanQuery = {}): string {
  const url = new URL(`${config.jikan.baseUrl}${path}`)
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * Perform a Jikan GET with classification + bounded retries.
 * Throws ApiError — never a raw fetch error.
 */
export async function jikanFetch<T>(
  path: string,
  query: JikanQuery = {},
  { signal }: { signal?: AbortSignal } = {},
): Promise<T> {
  const url = buildJikanUrl(path, query)
  const callId = ++callSeq
  const short = url.slice(url.indexOf('/v4'))
  // Dev-only ladder tracing (production strips the branch).
  const dbg = __DEV__
    ? (msg: string) => console.debug(`[jikan#${callId}] ${msg} ${short}`)
    : (_msg: string) => {}
  dbg('CALL')
  let lastError: ApiError = new ApiError('network', 'Jikan request failed')

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      dbg(`ABORT@loop attempt=${attempt}`)
      throw new ApiError('aborted', 'Request cancelled')
    }

    let res: Response
    try {
      await acquireSlot(signal)
      res = await fetchWithDeadline(url, undefined, { signal })
    } catch (err) {
      // Scheduler cancellation (StrictMode unmount / navigation) and the
      // request deadline both arrive as ApiError — neither is a transport
      // failure to burn the second attempt on: the first hands control back
      // to React Query, the timeout straight to `withFallback`, which is the
      // whole point of cutting the request at all.
      if (err instanceof ApiError) {
        dbg(`LADDER EXIT attempt=${attempt} kind=${err.kind} ${err.message}`)
        throw err
      }
      if (signal?.aborted || isAbortError(err)) {
        dbg(`ABORT@fetch attempt=${attempt}`)
        throw new ApiError('aborted', 'Request cancelled')
      }
      dbg(`NETFAIL attempt=${attempt} err=${err instanceof Error ? err.name : String(err)}`)
      lastError = new ApiError('network', 'Could not reach the anime API')
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRYABLE_WAIT_MS * attempt)
        continue
      }
      throw lastError
    }

    if (res.ok) {
      try {
        const parsed = (await res.json()) as T
        dbg('OK')
        return parsed
      } catch {
        throw new ApiError('unexpected', 'The anime API returned an unreadable response')
      }
    }

    if (res.status === 429) {
      dbg('429')
      lastError = new ApiError('rate-limited', 'Too many requests — please slow down', 429)
      if (attempt < MAX_ATTEMPTS) {
        // Global cool-down: every queued request waits too, instead of
        // the whole queue burning attempts against a closed window.
        const backoff = RATE_LIMIT_BACKOFF_MS[attempt - 1] ?? RETRYABLE_WAIT_MS
        cooldownUntil = Math.max(cooldownUntil, Date.now() + backoff)
        relayout()
        await sleep(backoff)
        continue
      }
      throw lastError
    }

    if (res.status === 404) throw new ApiError('not-found', 'Not found', 404)
    if (res.status === 400) throw new ApiError('bad-request', 'Invalid request', 400)

    if (res.status >= 500) {
      dbg(`5xx ${res.status}`)
      lastError = new ApiError('server', 'The anime API is having trouble', res.status)
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRYABLE_WAIT_MS * attempt)
        continue
      }
      throw lastError
    }

    throw new ApiError('unexpected', `Unexpected response (${res.status})`, res.status)
  }

  dbg(`THROW ${lastError.kind}`)
  throw lastError
}
