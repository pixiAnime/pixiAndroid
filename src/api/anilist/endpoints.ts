/**
 * AniList-backed equivalents of the Jikan endpoints. Every function returns
 * the same Jikan-shaped data, so callers (hooks, pages) never see a
 * difference when the fallback circuit switches sources.
 *
 * Never called directly by components — the Jikan endpoints wrap these
 * via withFallback (src/api/fallback.ts).
 */
import { ApiError } from '@/api/errors'
import { getCurrentSeason, type Season } from '@/lib/season'
import { anilistFetch } from './client'
import {
  ANILIST_CHARACTERS_QUERY,
  ANILIST_DETAIL_QUERY,
  ANILIST_ID_BY_MAL_QUERY,
  ANILIST_LIST_QUERY,
  ANILIST_RECOMMENDATIONS_QUERY,
} from './queries'
import {
  cappedTotal,
  keepMapped,
  toCharacters,
  toEnvelope,
  toJikanFull,
  toRecommendations,
} from './mapper'
import { splitGenreIds } from './genres'
import type { ALMediaResponse, ALPage } from './types'
import type {
  JikanAnime,
  JikanAnimeFull,
  JikanCharacterEntry,
  JikanEnvelope,
  JikanRecommendation,
} from '@/api/jikan/types'
import type { AnimeSearchParams, PageOptions } from '@/api/jikan/endpoints'

type ListVars = Record<string, unknown>
type TopFilter = 'airing' | 'upcoming' | 'bypopularity' | 'favorite'

async function listMedia(
  vars: ListVars,
  perPage: number,
  signal?: AbortSignal,
): Promise<JikanEnvelope<JikanAnime>> {
  const res = await anilistFetch<ALPage>(ANILIST_LIST_QUERY, vars, { signal })
  return toEnvelope(keepMapped(res.Page.media), res.Page.pageInfo, perPage)
}

export interface TopOptions extends PageOptions {
  filter?: TopFilter
}

/** Top anime — same four filters as Jikan's /top/anime. */
export async function anilistTop(options: TopOptions = {}): Promise<JikanEnvelope<JikanAnime>> {
  const { filter, page = 1, limit = 20, signal } = options
  const vars: ListVars = { page, perPage: limit }
  if (filter === 'airing') {
    vars.status = 'RELEASING'
    vars.sort = ['SCORE_DESC'] // top among currently airing
  } else if (filter === 'upcoming') {
    vars.status = 'NOT_YET_RELEASED'
    vars.sort = ['POPULARITY_DESC']
  } else if (filter === 'bypopularity') {
    vars.sort = ['POPULARITY_DESC']
  } else if (filter === 'favorite') {
    vars.sort = ['FAVOURITES_DESC']
  } else {
    vars.sort = ['SCORE_DESC']
  }
  return listMedia(vars, limit, signal)
}

/** Currently airing season (client clock — same source the hooks use). */
export async function anilistSeasonNow(
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  const { year, season } = getCurrentSeason()
  return listMedia(
    { page, perPage: limit, season: season.toUpperCase(), seasonYear: year, sort: ['POPULARITY_DESC'] },
    limit,
    signal,
  )
}

/** A specific season. */
export async function anilistSeason(
  year: number,
  season: Season,
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  return listMedia(
    { page, perPage: limit, season: season.toUpperCase(), seasonYear: year, sort: ['POPULARITY_DESC'] },
    limit,
    signal,
  )
}

/** Recently updated — UPDATED_AT_DESC (note: UPDATED_DESC is not a valid enum). */
export async function anilistRecentlyUpdated(
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanAnime>> {
  const { page = 1, limit = 20, signal } = options
  return listMedia({ page, perPage: limit, sort: ['UPDATED_AT_DESC'] }, limit, signal)
}

/* ------------------------------------------------------------------ */
/* search / browse                                                     */
/* ------------------------------------------------------------------ */

const SORT_FIELDS: Record<string, string> = {
  score: 'SCORE',
  popularity: 'POPULARITY',
  members: 'POPULARITY', // MAL "members" ≈ AniList popularity
  favorites: 'FAVOURITES',
  start_date: 'START_DATE',
  end_date: 'END_DATE',
  title: 'TITLE_ROMAJI',
  updated: 'UPDATED_AT',
}

const STATUS_VALUES: Record<string, string> = {
  airing: 'RELEASING',
  complete: 'FINISHED',
  upcoming: 'NOT_YET_RELEASED',
}

const FORMAT_VALUES: Record<string, string> = {
  tv: 'TV',
  movie: 'MOVIE',
  ova: 'OVA',
  ona: 'ONA',
  special: 'SPECIAL',
  music: 'MUSIC',
  tv_short: 'TV_SHORT',
}

const SEASON_VALUES: Record<string, string> = {
  winter: 'WINTER',
  spring: 'SPRING',
  summer: 'SUMMER',
  fall: 'FALL',
}

export interface SearchResults {
  items: JikanAnime[]
  page: number
  hasNextPage: boolean
  total: number
}

/**
 * Search / browse — translates the Jikan filter surface (q, type, status,
 * season, year, genres csv, order_by, sort) to AniList equivalents.
 * `rating` has no AniList equivalent and is intentionally ignored.
 */
export async function anilistSearch(params: AnimeSearchParams = {}): Promise<SearchResults> {
  const { signal, page = 1, limit = 20, q, type, status, season, year, genres, order_by, sort } =
    params
  const vars: ListVars = { page, perPage: limit }

  const query = q?.trim()
  if (query) vars.search = query

  if (type) {
    const format = FORMAT_VALUES[type.toLowerCase()]
    if (format) vars.format = format
  }
  if (status) {
    const value = STATUS_VALUES[status.toLowerCase()]
    if (value) vars.status = value
  }
  if (season) {
    const value = SEASON_VALUES[season.toLowerCase()]
    if (value) vars.season = value
  }
  const yearNum = Number(year)
  if (year && Number.isFinite(yearNum) && yearNum > 0) vars.seasonYear = yearNum

  // Genre ids → names, split into AniList genre vs tag (Isekai & co. are tags).
  const { genreIn, tagIn } = splitGenreIds(genres)
  if (genreIn.length > 0) vars.genreIn = genreIn
  if (tagIn.length > 0) vars.tagIn = tagIn

  if (order_by && SORT_FIELDS[order_by]) {
    const base = SORT_FIELDS[order_by]
    vars.sort = [sort === 'asc' ? base : `${base}_DESC`]
  } else if (query) {
    vars.sort = ['SEARCH_MATCH']
  } else {
    vars.sort = ['SCORE_DESC'] // browse without q — mirrors Jikan's default
  }

  const res = await anilistFetch<ALPage>(ANILIST_LIST_QUERY, vars, { signal })
  const info = res.Page.pageInfo
  return {
    items: keepMapped(res.Page.media),
    page: info.currentPage ?? page,
    hasNextPage: info.hasNextPage ?? false,
    total: cappedTotal(info),
  }
}

/* ------------------------------------------------------------------ */
/* single-title endpoints                                              */
/* ------------------------------------------------------------------ */

/** Full details by MAL id — AniList's Media stores `idMal`. */
export async function anilistAnimeFull(id: number, signal?: AbortSignal): Promise<JikanAnimeFull> {
  const res = await anilistFetch<ALMediaResponse>(ANILIST_DETAIL_QUERY, { idMal: id }, { signal })
  if (!res.Media || res.Media.idMal == null) throw new ApiError('not-found', 'Not found', 404)
  return toJikanFull(res.Media)
}

/** Characters with Japanese voice actors (flattened like the Jikan branch). */
export async function anilistCharacters(
  id: number,
  signal?: AbortSignal,
): Promise<JikanCharacterEntry[]> {
  const res = await anilistFetch<ALMediaResponse>(ANILIST_CHARACTERS_QUERY, { idMal: id }, { signal })
  if (!res.Media) throw new ApiError('not-found', 'Not found', 404)
  return toCharacters(res.Media)
}

/** Recommendations — a single list on AniList (page is not supported). */
export async function anilistRecommendations(
  id: number,
  options: PageOptions = {},
): Promise<JikanEnvelope<JikanRecommendation>> {
  const { limit = 12, signal } = options
  const res = await anilistFetch<ALMediaResponse>(
    ANILIST_RECOMMENDATIONS_QUERY,
    { idMal: id, perPage: limit },
    { signal },
  )
  const recommendations = toRecommendations(res.Media, limit)
  return {
    data: recommendations,
    pagination: {
      current_page: 1,
      last_visible_page: 1,
      has_next_page: false,
      items: { count: recommendations.length, total: recommendations.length, per_page: limit },
    },
  }
}

/**
 * AniList id for a MAL id (spec §5: extensions receive both ids).
 * The resolver is optional: any failure yields null so requests still
 * carry the MAL id — never blocks playback metadata.
 */
export async function anilistIdByMal(malId: number, signal?: AbortSignal): Promise<number | null> {
  if (!Number.isFinite(malId) || malId <= 0) return null
  try {
    const res = await anilistFetch<{ Media: { id: number } | null }>(
      ANILIST_ID_BY_MAL_QUERY,
      { idMal: malId },
      { signal },
    )
    return typeof res.Media?.id === 'number' ? res.Media.id : null
  } catch (err) {
    if (err instanceof ApiError && err.kind === 'aborted') throw err
    return null
  }
}
