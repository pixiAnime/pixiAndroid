/**
 * Aniskip skip-time shapes and the payload parser (mobile-owned).
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
  /** Stable id (`skipId`) — the player remembers what it already skipped. */
  id: string
  kind: SkipKind
  /** Seconds from the start of the episode. */
  startTime: number
  endTime: number
  /** Community confidence, 0–100. */
  score: number
}

/** The service also reports these; the player only skips openings and endings. */
const SUPPORTED_KINDS: readonly string[] = ['op', 'ed']

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Parse a `v2/skip-times` payload into intervals, dropping anything malformed.
 *
 * A community endpoint answers with whatever its contributors submitted, so
 * this trusts nothing: a missing or backwards interval is discarded rather
 * than handed to the player, which would otherwise seek somewhere arbitrary.
 * `result.found === false` and an unreadable shape both come back as `[]`,
 * which the caller treats the same way — no skip times for this episode.
 */
export function parseSkipTimes(payload: unknown): SkipInterval[] {
  const result = (payload as { result?: { found?: unknown; data?: unknown } } | null)?.result
  if (!result || result.found === false || !Array.isArray(result.data)) return []

  const intervals: SkipInterval[] = []
  for (const entry of result.data) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    const interval = raw.interval as Record<string, unknown> | undefined
    const start = num(interval?.startTime)
    const end = num(interval?.endTime)
    if (start === null || end === null || start < 0 || end <= start) continue

    const kind = String(raw.skipType ?? '').toLowerCase()
    if (!SUPPORTED_KINDS.includes(kind)) continue

    const id = typeof raw.skipId === 'number' ? String(raw.skipId) : `${kind}:${start}`
    intervals.push({
      id,
      kind: kind as SkipKind,
      startTime: start,
      endTime: end,
      score: num(raw.score) ?? 0,
    })
  }
  return intervals
}