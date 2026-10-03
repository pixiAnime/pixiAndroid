/**
 * Query hooks — the component-facing API for anime data.
 * Components never call endpoint functions or fetch() directly.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  getAnimeCharacters,
  getAnimeFull,
  getAnimeRecommendations,
  getGenres,
  getRecentlyUpdated,
  getSeason,
  getSeasonNow,
  getTopAnime,
  searchAnime,
  type AnimeSearchParams,
} from '@/api/jikan/endpoints'
import { jikanKeys } from '@/api/jikan/queries'
import { getCurrentSeason } from '@/lib/season'

export type TopFilter = 'airing' | 'upcoming' | 'bypopularity' | 'favorite'

export function useTopAnime(filter?: TopFilter, limit = 18) {
  return useQuery({
    queryKey: jikanKeys.top(filter),
    queryFn: ({ signal }) => getTopAnime({ filter, limit, signal }),
    staleTime: 10 * 60_000, // rankings move slowly
  })
}

export function useSeasonNow(limit = 18) {
  return useQuery({
    queryKey: jikanKeys.seasonNow(),
    queryFn: ({ signal }) => getSeasonNow({ limit, signal }),
    staleTime: 60 * 60_000, // a season runs for months
  })
}

export function useCurrentSeasonAnime(limit = 18) {
  const { year, season } = getCurrentSeason()
  return useQuery({
    queryKey: jikanKeys.season(year, season),
    queryFn: ({ signal }) => getSeason(year, season, { limit, signal }),
    staleTime: 60 * 60_000,
  })
}

export function useRecentlyUpdated(limit = 18) {
  return useQuery({
    queryKey: jikanKeys.recentlyUpdated(),
    queryFn: ({ signal }) => getRecentlyUpdated({ limit, signal }),
    staleTime: 15 * 60_000, // updates matter — refresh sooner
  })
}

/** Currently airing ordered by members (distinct angle from top/airing). */
export function useCurrentlyAiring(limit = 18) {
  return useQuery({
    queryKey: jikanKeys.search({ status: 'airing', order_by: 'members', limit }),
    queryFn: ({ signal }) =>
      searchAnime({ status: 'airing', order_by: 'members', sort: 'desc', limit, signal }),
    staleTime: 10 * 60_000,
  })
}

export function useAnimeDetail(id: number) {
  return useQuery({
    queryKey: jikanKeys.detail(id),
    queryFn: ({ signal }) => getAnimeFull(id, signal),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 30 * 60_000,
  })
}

export function useAnimeCharacters(id: number) {
  return useQuery({
    queryKey: jikanKeys.characters(id),
    queryFn: ({ signal }) => getAnimeCharacters(id, signal),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 60 * 60_000,
  })
}

export function useAnimeRecommendations(id: number) {
  return useQuery({
    queryKey: jikanKeys.recommendations(id),
    queryFn: ({ signal }) => getAnimeRecommendations(id, { page: 1, limit: 12, signal }),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 60 * 60_000,
  })
}

export function useGenres() {
  return useQuery({
    queryKey: jikanKeys.genres,
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: 24 * 60 * 60_000, // genres are static
  })
}

/* ------------------------------------------------------------------ */
/* Search + browse — paginated                                         */
/* ------------------------------------------------------------------ */

export function useAnimeSearch(params: AnimeSearchParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: jikanKeys.search(params),
    queryFn: ({ pageParam, signal }) => searchAnime({ ...params, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
    enabled: enabled && Boolean(params.q && params.q.trim().length > 0),
    staleTime: 2 * 60_000, // fresh results during typing sessions
  })
}

export function useBrowseAnime(params: AnimeSearchParams) {
  return useInfiniteQuery({
    queryKey: jikanKeys.search({ ...params, q: params.q ?? '' }),
    queryFn: ({ pageParam, signal }) => searchAnime({ ...params, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  })
}
