/**
 * Centralized query keys — every TanStack Query in the app derives from here
 * so cache invalidation stays predictable.
 */
import type { AnimeSearchParams, PageOptions } from '@/api/jikan/endpoints'

export const jikanKeys = {
  all: ['jikan'] as const,
  top: (filter?: string, params: PageOptions = {}) =>
    ['jikan', 'top', filter ?? 'default', params.page ?? 1] as const,
  seasonNow: (params: PageOptions = {}) => ['jikan', 'season-now', params.page ?? 1] as const,
  season: (year: number, season: string, params: PageOptions = {}) =>
    ['jikan', 'season', year, season, params.page ?? 1] as const,
  recentlyUpdated: (params: PageOptions = {}) =>
    ['jikan', 'recently-updated', params.page ?? 1] as const,
  search: (params: AnimeSearchParams) => ['jikan', 'search', params] as const,
  genres: ['jikan', 'genres'] as const,
  detail: (id: number) => ['jikan', 'anime', id] as const,
  characters: (id: number) => ['jikan', 'anime', id, 'characters'] as const,
  recommendations: (id: number, page = 1) =>
    ['jikan', 'anime', id, 'recommendations', page] as const,
  episodes: (id: number, page = 1) => ['jikan', 'anime', id, 'episodes', page] as const,
}
