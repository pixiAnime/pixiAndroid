/**
 * Shared API error taxonomy.
 *
 * Both data sources (Jikan and the AniList fallback) throw this error, so
 * React Query, the friendly error states and the fallback circuit classify
 * failures identically. Raw fetch/GraphQL errors never reach the UI.
 */
export type ApiErrorKind =
  | 'network' // fetch failed / API unreachable
  | 'rate-limited' // 429 — retries exhausted
  | 'not-found' // 404 / unknown id
  | 'bad-request' // 400 — invalid params/id
  | 'server' // 5xx from Jikan, MAL or AniList
  | 'aborted' // caller cancelled (StrictMode unmount / navigation) — never retry
  | 'unexpected' // unparseable / unknown

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}
