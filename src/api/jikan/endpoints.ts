/**
 * Endpoint functions — the only place that knows data-source details.
 * Components call these (via hooks/queries), never fetch() directly.
 *
 * Every function prefers Jikan (MyAnimeList) and transparently falls back
 * to AniList when the Jikan service is failing (src/api/fallback.ts).
 * Both branches return the same Jikan-shaped data.
 */
import { jikanFetch } from './client'
import { withFallback } from '@/api/fallback'
import {
  anilistAnimeFull,
  anilistCharacters,
  anilistRecentlyUpdated,
  anilistRecommendations,
  anilistSearch,
  anilistSeason,
  anilistSeasonNow,
  anilistTop,
} from '@/api/anilist/endpoints'
import { MAL_GENRES } from '@/api/anilist/genres'
import type {
  JikanAnime,
  JikanAnimeFull,
  JikanCharacterEntry,
  JikanEpisode,
  JikanEnvelope,
  JikanGenre,
  JikanRecommendation,
  JikanSingle,
  JikanVoiceActor,
} from './types'

export interface PageOptions {
  page?: number
  limit?: number
  signal?: AbortSignal
}

/** Top anime — filter: airing | upcoming | bypopularity | favorite. */
export async function getTopAnime(
  options: PageOptions & { filter?: 'airing' | 'upcoming' | 'bypopularity' | 'favorite' } = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { filter, page = 1, limit = 20, signal } = options
  return withFallback(
    () => jikanFetch('/top/anime', { page, limit, filter }, { signal }),
    () => anilistTop({ filter, page, limit, signal }),
  )
}

/** Currently airing season. */
export async function getSeasonNow(
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  return withFallback(
    () => jikanFetch('/seasons/now', { page, limit }, { signal }),
    () => anilistSeasonNow({ page, limit, signal }),
  )
}

/** A specific season: /seasons/{year}/{season}. */
export async function getSeason(
  year: number,
  season: 'winter' | 'spring' | 'summer' | 'fall',
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  return withFallback(
    () => jikanFetch(`/seasons/${year}/${season}`, { page, limit }, { signal }),
    () => anilistSeason(year, season, { page, limit, signal }),
  )
}

/** Recently updated/added anime (order_by=updated). */
export async function getRecentlyUpdated(
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  return withFallback(
    () => jikanFetch('/anime', { page, limit, order_by: 'updated', sort: 'desc' }, { signal }),
    () => anilistRecentlyUpdated({ page, limit, signal }),
  )
}

/** Full anime details (includes relations). */
export async function getAnimeFull(id: number, signal?: AbortSignal): Promise<JikanAnimeFull> {
  return withFallback(
    async () => {
      const res = await jikanFetch<JikanSingle<JikanAnimeFull>>(`/anime/${id}/full`, {}, { signal })
      return res.data
    },
    () => anilistAnimeFull(id, signal),
  )
}

/** Characters & voice actors (normalized to a flat `voices[]`). */
export async function getAnimeCharacters(
  id: number,
  signal?: AbortSignal,
): Promise<JikanCharacterEntry[]> {
  return withFallback(
    async () => {
      const res = await jikanFetch<JikanEnvelope<JikanCharacterEntry>>(
        `/anime/${id}/characters`,
        {},
        { signal },
      )
      return res.data.map((entry) => ({ ...entry, voices: flattenVoiceActors(entry) }))
    },
    () => anilistCharacters(id, signal),
  )
}

/**
 * Jikan ships `voice_actors[].person` — the UI reads a flat `voices[]`.
 * Prefer Japanese actors (Jikan's own relevance order otherwise).
 */
function flattenVoiceActors(entry: JikanCharacterEntry): JikanVoiceActor[] {
  if (entry.voices?.length) return entry.voices
  const actors = entry.voice_actors ?? []
  const japanese = actors.filter((a) => (a.language ?? '').toLowerCase() === 'japanese')
  return (japanese.length > 0 ? japanese : actors).map((a) => a.person)
}

/**
 * Recommendations (paginated). Jikan only accepts `page` here — no `limit`.
 */
export async function getAnimeRecommendations(
  id: number,
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanRecommendation>> {
  const { page = 1, signal } = options
  return withFallback(
    () => jikanFetch(`/anime/${id}/recommendations`, { page }, { signal }),
    () => anilistRecommendations(id, { ...options, page }),
  )
}

/** Episode list (paginated — Jikan returns 100/page, `page` is the only param). */
export async function getAnimeEpisodes(
  id: number,
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanEpisode>> {
  const { page = 1, signal } = options
  return withFallback(
    () => jikanFetch(`/anime/${id}/episodes`, { page }, { signal }),
    // AniList has no episode lists — return an empty envelope so the episode
    // provider builds its synthetic numbered list from the episode count.
    async () => ({
      data: [],
      pagination: {
        current_page: page,
        last_visible_page: page,
        has_next_page: false,
        items: { count: 0, total: 0, per_page: 100 },
      },
    }),
  )
}

/** All genres (with counts) for the discovery page. */
export async function getGenres(signal?: AbortSignal): Promise<JikanGenre[]> {
  return withFallback(
    async () => {
      const res = await jikanFetch<JikanEnvelope<JikanGenre>>('/genres/anime', {}, { signal })
      return res.data
    },
    // Static snapshot of /genres/anime (78 MAL genres) — never fails.
    async () => MAL_GENRES,
  )
}

export interface AnimeSearchParams extends PageOptions {
  q?: string
  type?: string
  status?: string
  rating?: string
  season?: string
  year?: number | string
  genres?: string
  order_by?: string
  sort?: 'desc' | 'asc'
}

/** Search / browse — shared query surface (q supports EN/JP/romaji/synonyms). */
export async function searchAnime(params: AnimeSearchParams = {}): Promise<{
  items: JikanAnime[]
  page: number
  hasNextPage: boolean
  total: number
}> {
  const { signal, page = 1, limit = 20, ...filters } = params
  return withFallback(
    async () => {
      // filters: q, type, status, rating, season, year, genres, order_by, sort
      const res = await jikanFetch<JikanEnvelope<JikanAnime>>(
        '/anime',
        { page, limit, ...filters },
        { signal },
      )
      return {
        items: res.data,
        // current_page is THIS response's page — last_visible_page would jump
        // the infinite scroll to the end of the result set.
        page: res.pagination.current_page ?? page,
        hasNextPage: res.pagination.has_next_page,
        total: res.pagination.items?.total ?? res.data.length,
      }
    },
    () => anilistSearch(params),
  )
}
