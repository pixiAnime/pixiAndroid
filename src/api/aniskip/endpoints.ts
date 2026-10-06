/**
 * Aniskip endpoint (mobile-owned).
 *
 * One request per episode: `GET /v1/skip-times/{malId}/{episode}` with the kinds
 * we care about and, when Jikan told us, the episode length — the service
 * scores its matches against it, so a known length turns a guess into a match.
 *
 * No fallback and no retry ladder, unlike `jikanFetch`: Aniskip is a single
 * community service, not one of two mirrors for the same data, so a miss
 * simply means "no skip times here". Callers render nothing on an empty list.
 */
import { fetchWithDeadline } from '@/api/deadline'

import { parseSkipTimes, skipTimesUrl, type SkipInterval, type SkipKind } from './parse'

/** Cut at 6s like every other request in the app — a skip time that arrives
 * late is a skip time the opening has already played through. */
const ANISKIP_TIMEOUT_MS = 6_000

export interface SkipTimesOptions {
  /** MyAnimeList id — the app routes on MAL ids throughout. */
  malId: number
  /** Episode number, 1-based. */
  episode: number
  /** Episode length in seconds; omit when unknown. */
  episodeLength?: number
  types?: readonly SkipKind[]
  signal?: AbortSignal
}

export async function getSkipTimes({
  malId,
  episode,
  episodeLength,
  types = ['op', 'ed'],
  signal,
}: SkipTimesOptions): Promise<SkipInterval[]> {
  const url = skipTimesUrl({ malId, episode, episodeLength, types }).toString()

  const response = await fetchWithDeadline(
    url,
    { headers: { Accept: 'application/json' } },
    { signal, timeoutMs: ANISKIP_TIMEOUT_MS },
  )
  if (!response.ok) {
    // A 4xx here is a request we built wrong, not the service being down —
    // the only signal for it, since the caller treats any failure as silence.
    console.warn('[aniskip]', response.status, url)
    return []
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return [] // an unreadable body is the same as no data
  }
  return parseSkipTimes(payload)
}
