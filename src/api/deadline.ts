/**
 * `fetch` with a hard deadline layered over the caller's abort signal.
 *
 * React Native's fetch carries no timeout of its own: a connection that is
 * blackholed (route accepted, host never answers) only gives up when OkHttp's
 * own connect/read windows lapse, ~10–15s per attempt. `api/jikan.moe` did
 * exactly that while `graphql.anilist.co` answered in 0.4s, and because
 * `withFallback` only calls the AniList fallback **after** the Jikan ladder
 * has finished, every attempt spent the whole budget before handing over:
 *
 *   2 attempts x ~12s  ≈  25s of nothing  ->  first paint at ~30s
 *
 * The app only *showed* it on a fresh install. A warm install rehydrates
 * `pixiweb.query-cache.v1` synchronously at module load, so `hasData` is true
 * from the first frame and `useConnectionStatus` hides the chip while the same
 * stall happens invisibly behind it; wiping the app removed the cache and the
 * mask together, leaving the header on "Connecting…" for the whole window.
 *
 * A timeout is thrown as `network` on purpose:
 *
 *  - `withFallback.isServiceFailure` treats it as a service failure, so the
 *    request falls through to AniList and the circuit breaker counts it;
 *  - unlike AniList — which has nothing beneath *it* and so retries — Jikan's
 *    second attempt is not spent on a host that already failed to answer:
 *    the fallback is the correct next step, and waiting it out is the stall
 *    this module exists to remove.
 *
 * Everything else is passed through untouched: a caller abort stays `aborted`
 * (never retried, never a service failure) and a raw fetch error leaves as the
 * original error so the client's own retry ladder keeps classifying it.
 *
 * This lives in its own module (rather than beside `jikanFetch`, the way
 * `postWithDeadline` sits in the AniList client) because it imports nothing
 * but `./errors`, which is what makes the deadline testable under `node --test`
 * without a renderer or the `@/` alias.
 */
import { ApiError } from './errors.ts'

/** Default cap on one request: Jikan answers in well under a second. */
export const DEFAULT_TIMEOUT_MS = 6_000

export interface DeadlineOptions {
  /** Caller's signal (react-query's) — aborting it cancels the request too. */
  signal?: AbortSignal
  /** Hard cap for this call. */
  timeoutMs?: number
}

export async function fetchWithDeadline(
  url: string,
  init?: Parameters<typeof fetch>[1],
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: DeadlineOptions = {},
): Promise<Response> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, timeoutMs)

  const onAbort = () => ctrl.abort()
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer)
      throw new ApiError('aborted', 'Request cancelled')
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (error) {
    // Order matters: the caller cancelling wins over the deadline, so an
    // unmount mid-timeout still reads as `aborted`, not as a service failure.
    if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled')
    if (timedOut) throw new ApiError('network', `Request timed out after ${timeoutMs}ms`)
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
