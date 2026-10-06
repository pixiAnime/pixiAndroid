/**
 * Skip times for the episode on screen (Aniskip).
 *
 * A separate hook rather than a line in `useAnimeData`: that file is copied
 * verbatim from pixiWeb, which has no player to skip in. Cache is per episode
 * and effectively permanent — skip times are crowd-submitted data that does
 * not change within a season — so a revisit of the same episode costs nothing
 * and a failure is not retried into the user's face.
 *
 * Returns the intervals and nothing else: the player renders a button when
 * one is live and stays silent when there is none, so "loading" and "failed"
 * are the same thing to it — an empty list — and there is no UI that could
 * tell them apart.
 */
import { useQuery } from '@tanstack/react-query'

import { getSkipTimes } from '@/api/aniskip'
import type { SkipInterval, SkipKind } from '@/api/aniskip'

export const skipTimesKeys = {
  episode: (malId: number, episode: number, length?: number) =>
    ['aniskip', malId, episode, Math.round(length ?? 0)] as const,
}

/** A day: the data is stable, and a stale entry is harmless either way. */
const STALE_TIME_MS = 24 * 60 * 60 * 1000

/**
 * One array for every "nothing here" answer, so the prop the page hands the
 * player keeps its identity between renders instead of resetting the
 * auto-skip bookkeeping on each of them.
 */
const NONE: SkipInterval[] = []

export function useSkipTimes({
  malId,
  episode,
  episodeLength,
  types,
  enabled,
}: {
  malId: number | null
  episode: number
  episodeLength?: number
  types?: readonly SkipKind[]
  enabled: boolean
}): SkipInterval[] {
  const query = useQuery({
    queryKey: skipTimesKeys.episode(malId ?? 0, episode, episodeLength),
    enabled: enabled && malId !== null && malId > 0 && episode > 0,
    staleTime: STALE_TIME_MS,
    // A miss is an answer, not a failure: retrying an endpoint that simply has
    // nothing for this episode would only produce duplicate requests.
    retry: false,
    queryFn: ({ signal }) =>
      getSkipTimes({
        malId: malId as number,
        episode,
        episodeLength,
        types,
        signal,
      }),
  })

  return query.data ?? NONE
}
