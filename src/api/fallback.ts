/**
 * Automatic data-source fallback with a circuit breaker.
 *
 * Jikan (MyAnimeList) stays primary. When it starts failing — MAL outages,
 * 5xx storms, rate limits — consecutive service failures open the circuit
 * and every subsequent request skips straight to the AniList fallback for
 * COOLDOWN_MS; the first request after that probes Jikan again (half-open).
 * One successful Jikan response closes the circuit immediately.
 *
 * `not-found` / `bad-request` / `aborted` never trip the breaker: those are
 * answers about the request, not about the service being down.
 */
import { ApiError } from '@/api/errors'

const FAILURE_THRESHOLD = 2
const COOLDOWN_MS = 60_000

let consecutiveFailures = 0
let openUntil = 0

export type DataSource = 'jikan' | 'anilist'
let source: DataSource = 'jikan'

/** Which source served the last successful request (debug/introspection). */
export function currentDataSource(): DataSource {
  return source
}

/** Service-level failures are fallback-worthy; request-level ones are not. */
function isServiceFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return (
    error.kind === 'network' ||
    error.kind === 'server' ||
    error.kind === 'rate-limited' ||
    error.kind === 'unexpected'
  )
}

// Dev-only: trace circuit transitions (production strips the branch).
const dbg = (__DEV__)
  ? (msg: string) => console.debug(`[fallback] ${msg}`)
  : (_msg: string) => {}

/**
 * Run `primary` (Jikan); on a service-level failure fall back to `secondary`
 * (AniList). While the circuit is open, `primary` is skipped entirely.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  secondary: () => Promise<T>,
): Promise<T> {
  const circuitOpen = Date.now() < openUntil

  if (!circuitOpen) {
    try {
      const value = await primary()
      if (consecutiveFailures > 0 || openUntil > 0) dbg('Jikan healthy again — circuit closed')
      consecutiveFailures = 0
      openUntil = 0
      source = 'jikan'
      return value
    } catch (error) {
      if (!isServiceFailure(error)) throw error // bad id / cancelled — not a service problem
      consecutiveFailures += 1
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        openUntil = Date.now() + COOLDOWN_MS
        dbg(
          `circuit OPEN for ${COOLDOWN_MS / 1000}s after ${consecutiveFailures} failures — using AniList`,
        )
      } else {
        dbg(`${consecutiveFailures}/${FAILURE_THRESHOLD} Jikan failures — AniList for this request`)
      }
    }
  }

  source = 'anilist'
  return secondary()
}
