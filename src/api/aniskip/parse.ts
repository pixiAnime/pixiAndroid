/**
 * Aniskip request URL and response parser (mobile-owned).
 *
 * Aniskip (https://aniskip.com) is a community service that answers one
 * question — "where does episode N of this anime stop being the opening?" —
 * from the MAL id the app already holds and the episode length it can work
 * out from Jikan. It is not a pixiWeb-synced module: the web build has no
 * player to skip in, so this whole layer is Android-only.
 *
 * Kept free of imports on purpose, so it can be unit-tested under Node without
 * the Metro alias resolver — the same reason `RepoLoader` keeps its own
 * timeout constant.
 */

export type SkipKind = 'op' | 'ed'

/** One interval the viewer can jump out of. */
export interface SkipInterval {
  /** Stable id (`skip_id`) — the player remembers what it already skipped. */
  id: string
  kind: SkipKind
  /** Seconds from the start of the episode. */
  startTime: number
  endTime: number
}

/** The service also reports these; the player only skips openings and endings. */
const SUPPORTED_KINDS: readonly string[] = ['op', 'ed']

const BASE_URL = 'https://api.aniskip.com/v1/skip-times'

export interface SkipTimesRequest {
  /** MyAnimeList id — the app routes on MAL ids throughout. */
  malId: number
  /** Episode number, 1-based. The path segment the endpoint cannot do without. */
  episode: number
  /** Episode length in seconds; omit when unknown. */
  episodeLength?: number
  types?: readonly SkipKind[]
}

/**
 * The one request URL for an episode.
 *
 * `/{malId}/{episode}` — the episode segment is the whole point: without it
 * the service answers 404 and the player never sees a button. `types` has to
 * arrive as repeated `types=` params (a single comma-joined value is a 400),
 * and `episodeLength` is optional — the endpoint scores its matches with it
 * when it has it and answers without it when it does not.
 */
export function skipTimesUrl({
  malId,
  episode,
  episodeLength,
  types = ['op', 'ed'],
}: SkipTimesRequest): URL {
  const url = new URL(`${BASE_URL}/${malId}/${Math.round(episode)}`)
  for (const type of types) url.searchParams.append('types', type)
  if (episodeLength && episodeLength > 0) {
    url.searchParams.set('episodeLength', String(Math.round(episodeLength)))
  }
  return url
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Parse a `v1/skip-times` payload into intervals, dropping anything malformed.
 *
 * The payload answers `snake_case` — `{ found, results: [{ interval:
 * { start_time, end_time }, skip_type, skip_id }] }` — and a community endpoint
 * answers with whatever its contributors submitted, so this trusts nothing: a
 * missing or backwards interval is discarded rather than handed to the player,
 * which would otherwise seek somewhere arbitrary. `found === false` and an
 * unreadable shape both come back as `[]`, which the caller treats the same
 * way — no skip times for this episode.
 */
export function parseSkipTimes(payload: unknown): SkipInterval[] {
  const body = payload as
    | { found?: unknown; results?: unknown }
    | null
  if (!body || body.found === false || !Array.isArray(body.results)) return []

  const intervals: SkipInterval[] = []
  for (const entry of body.results) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    const interval = raw.interval as Record<string, unknown> | undefined
    const start = num(interval?.start_time)
    const end = num(interval?.end_time)
    if (start === null || end === null || start < 0 || end <= start) continue

    const kind = String(raw.skip_type ?? '').toLowerCase()
    if (!SUPPORTED_KINDS.includes(kind)) continue

    const id = typeof raw.skip_id === 'string' && raw.skip_id ? raw.skip_id : `${kind}:${start}`
    intervals.push({ id, kind: kind as SkipKind, startTime: start, endTime: end })
  }
  return intervals
}
