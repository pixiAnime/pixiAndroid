/**
 * Aniskip endpoint (mobile-owned).
 *
 * One request per episode: `GET /v2/skip-times/{malId}/` with the kinds we
 * care about and, when Jikan told us, the episode length — the service scores
 * its matches against it, so a known length turns a guess into a match.
 *
 * No fallback and no retry ladder, unlike `jikanFetch`: Aniskip is a single
 * community service, not one of two mirrors for the same data, so a miss
 * simply means "no skip times here". Callers render nothing on an empty list.
 */
import { fetchWithDeadline } from '@/api/deadline'

import { parseSkipTimes, type SkipInterval, type SkipKind } from './parse'

const BASE_URL = 'https://api.aniskip.com'

/** Cut at 6s like every other request in the app — a skip time that arrives
 * late is a skip time the opening has already played through. */
const ANISKIP_TIMEOUT_MS = 6_000

export interface SkipTimesOptions {
  /** MyAnimeList id — the app routes on MAL ids throughout. */
  malId: number
  /** Episode length in seconds; omit when unknown. */
  episodeLength?: number
  types?: readonly SkipKind[]
  signal?: AbortSignal
}

export async function getSkipTimes({
  malId,
  episodeLength,
  types = ['op', 'ed'],
  signal,
}: SkipTimesOptions): Promise<SkipInterval[]> {
  const url = new URL(`${BASE_URL}/v2/skip-times/${malId}/`)
  for (const type of types) url.searchParams.append('types', type)
  if (episodeLength && episodeLength > 0) {
    url.searchParams.set('episodeLength', String(Math.round(episodeLength)))
  }

  const response = await fetchWithDeadline(
    url.toString(),
    { headers: { Accept: 'application/json' } },
    { signal, timeoutMs: ANISKIP_TIMEOUT_MS },
  )
  if (!response.ok) return []

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return [] // an unreadable body is the same as no data
  }
  return parseSkipTimes(payload)
}