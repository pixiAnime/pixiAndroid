/**
 * Episode data hook — the Watch page talks to this, never to a provider
 * directly. When the streaming API lands, only the provider changes.
 */
import { useQuery } from '@tanstack/react-query'
import { episodeProvider, type EpisodeList } from '@/providers/episode'
import { queryClient } from '@/lib/queryClient'

export function episodeQueryKey(
  animeId: number,
  page = 1,
  totalEpisodes: number | null = null,
): readonly unknown[] {
  // totalEpisodes is part of the key on purpose: the synthetic numbered-list
  // fallback (provider) can only be built once the detail's episode count is
  // known, so a result cached with `null` must refetch when the detail lands.
  return ['episodes', episodeProvider.id, animeId, page, totalEpisodes ?? null]
}

export interface UseEpisodesOptions {
  totalEpisodes?: number | null
  page?: number
  enabled?: boolean
}

export function useEpisodes(animeId: number, options: UseEpisodesOptions = {}) {
  const { totalEpisodes, page = 1, enabled = true } = options
  return useQuery<EpisodeList>({
    queryKey: episodeQueryKey(animeId, page, totalEpisodes ?? null),
    queryFn: ({ signal }) =>
      episodeProvider.getEpisodes(animeId, { page, totalEpisodes, signal }),
    enabled: enabled && Number.isFinite(animeId) && animeId > 0,
    staleTime: 60 * 60_000, // episode lists are stable
  })
}

/** Prefetch the next page of episodes (used by episode-list pagination). */
export function prefetchEpisodes(animeId: number, page: number, totalEpisodes?: number | null) {
  void queryClient.prefetchQuery({
    queryKey: episodeQueryKey(animeId, page, totalEpisodes ?? null),
    queryFn: ({ signal }) =>
      episodeProvider.getEpisodes(animeId, { page, totalEpisodes, signal }),
  })
}
