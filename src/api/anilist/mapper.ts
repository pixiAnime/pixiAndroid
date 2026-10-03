/**
 * AniList → Jikan shape adapter.
 *
 * The whole app (hooks, pages, components) is typed against Jikan's MAL
 * mirror. The fallback maps AniList GraphQL results onto those exact shapes
 * so no UI code changes when the source switches.
 *
 * Id semantics are preserved: every mapped item carries AniList's `idMal`
 * as `mal_id` (entries without one are dropped — their /anime/:id route
 * couldn't resolve), so routes and caches keep MyAnimeList's ids.
 */
import { ApiError } from '@/api/errors'
import type {
  JikanAnime,
  JikanAnimeFull,
  JikanCharacterEntry,
  JikanEnvelope,
  JikanImages,
  JikanMalName,
  JikanRecommendation,
  JikanVoiceActor,
} from '@/api/jikan/types'
import { malGenreByAlName } from './genres'
import type { ALDate, ALMedia, ALPageInfo, ALRanking } from './types'

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** AniList descriptions carry light HTML — strip to plain text. */
function stripHtml(value?: string | null): string {
  if (!value) return ''
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#0?39;/g, "'")
    .replace(/&(?:amp|lt|gt|quot|nbsp);/g, (m) => {
      switch (m) {
        case '&amp;': return '&'
        case '&lt;': return '<'
        case '&gt;': return '>'
        case '&quot;': return '"'
        default: return ' '
      }
    })
    .trim()
}

function isoDate(d?: ALDate | null): string | null {
  if (!d?.year || !d.month || !d.day) return null
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T00:00:00+00:00`
}

function prettyDate(d?: ALDate | null): string | null {
  if (!d?.year || !d.month || !d.day) return null
  return `${MONTHS[d.month - 1]} ${d.day}, ${d.year}`
}

function dateProp(d?: ALDate | null): { year: number; month: number; day: number } | undefined {
  if (!d?.year || !d.month || !d.day) return undefined
  return { year: d.year, month: d.month, day: d.day }
}

const STATUS_MAP: Record<string, string> = {
  RELEASING: 'Currently Airing',
  FINISHED: 'Finished Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On hiatus',
}

const FORMAT_MAP: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV',
  MOVIE: 'Movie',
  OVA: 'OVA',
  ONA: 'ONA',
  SPECIAL: 'Special',
  MUSIC: 'Music',
}

const SOURCE_MAP: Record<string, string> = {
  ORIGINAL: 'original',
  MANGA: 'manga',
  LIGHT_NOVEL: 'light novel',
  NOVEL: 'novel',
  DOUJINSHI: 'doujinshi',
  WEB_NOVEL: 'web novel',
  GAME: 'game',
  VISUAL_NOVEL: 'visual novel',
  OTHER: 'other',
  ANIME: 'anime',
}

const RELATION_MAP: Record<string, string> = {
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequel',
  SOURCE: 'Source',
  ADAPTATION: 'Adaptation',
  PARENT: 'Parent',
  SIDE_STORY: 'Side story',
  SPIN_OFF: 'Spin off',
  CHARACTER: 'Character',
  SUMMARY: 'Summary',
  ALTERNATIVE: 'Alternative',
  FULL_STORY: 'Full story',
  OTHER: 'Other',
}

/** AniList genre names → MAL genre chips (unknown names dropped). */
export function toMalGenres(names?: (string | null)[] | null): JikanMalName[] {
  const out: JikanMalName[] = []
  for (const raw of names ?? []) {
    if (!raw) continue
    const g = malGenreByAlName(raw)
    if (!g) continue // no MAL counterpart — rather drop than link a dead id
    out.push({ mal_id: g.mal_id, type: 'genre', name: g.name, url: g.url })
  }
  return out
}

function toImages(m: ALMedia): JikanImages {
  const large = m.coverImage?.extraLarge ?? m.coverImage?.large ?? undefined
  const small = m.coverImage?.large ?? m.coverImage?.medium ?? undefined
  const medium = m.coverImage?.medium ?? undefined
  return {
    // UI prefers webp.large_image_url first — AniList covers are a single
    // asset, so jpg/webp point at the same URLs.
    jpg: { image_url: medium, small_image_url: small, large_image_url: large },
    webp: { image_url: medium, small_image_url: small, large_image_url: large },
  }
}

function pickRank(rankings: ALRanking[] | null | undefined, current: string, allTime: string): number | null {
  if (!rankings) return null
  return (
    rankings.find((r) => r.context === current)?.rank ??
    rankings.find((r) => r.context === allTime)?.rank ??
    null
  )
}

/* ------------------------------------------------------------------ */
/* core mappings                                                       */
/* ------------------------------------------------------------------ */

/** Map one AniList media node; null when it has no MAL id (route wouldn't resolve). */
export function toJikanAnime(m: ALMedia): JikanAnime | null {
  if (m.idMal == null) return null

  const title = m.title?.romaji ?? m.title?.english ?? ''
  const startIso = isoDate(m.startDate)
  const endIso = isoDate(m.endDate)
  const startPretty = prettyDate(m.startDate)
  const endPretty = prettyDate(m.endDate)

  // Jikan-style aired string: "Jul 6, 2026 to ?" while airing, same-day shows bare.
  let airedString: string | undefined
  if (startPretty) {
    if (endPretty && endPretty !== startPretty) airedString = `${startPretty} to ${endPretty}`
    else if (!endPretty || m.status === 'RELEASING') airedString = `${startPretty} to ?`
    else airedString = startPretty
  }

  const status = m.status ? STATUS_MAP[m.status] : undefined

  return {
    mal_id: m.idMal,
    url: `https://myanimelist.net/anime/${m.idMal}`,
    images: toImages(m),
    title,
    title_english: m.title?.english ?? null,
    title_japanese: m.title?.native ?? null,
    title_synonyms: (m.synonyms ?? []).filter((s): s is string => Boolean(s)),
    type: m.format ? (FORMAT_MAP[m.format] ?? m.format) : null,
    source: mapSource(m.source),
    episodes: m.episodes ?? null,
    status,
    airing: m.status === 'RELEASING' || m.nextAiringEpisode != null,
    aired: {
      from: startIso,
      to: endIso,
      string: airedString,
      prop: { from: dateProp(m.startDate), to: dateProp(m.endDate) },
    },
    duration: m.duration ? `${m.duration} min per ep` : undefined,
    score: m.meanScore != null ? Math.round(m.meanScore) / 10 : null,
    scored_by: null, // AniList exposes no vote count
    rank: pickRank(m.rankings, 'highest rated', 'highest rated all time'),
    popularity: pickRank(m.rankings, 'most popular', 'most popular all time'),
    members: m.popularity ?? null, // AniList "popularity" is a member count
    favorites: m.favourites ?? null,
    synopsis: stripHtml(m.description),
    background: m.bannerImage ?? null,
    season: m.season ? m.season.toLowerCase() : null,
    year: m.seasonYear ?? m.startDate?.year ?? null,
    genres: toMalGenres(m.genres),
    studios: (m.studios?.nodes ?? []).map((s) => ({
      mal_id: s.id,
      type: 'studio',
      name: s.name,
      url: '', // AniList studio ids are not MAL producer ids — name is all the UI reads
    })),
  }
}

function mapSource(value?: string | null): string | undefined {
  if (!value) return undefined
  return SOURCE_MAP[value] ?? value.toLowerCase().replace(/_/g, ' ')
}

function mapRelation(value: string): string {
  return RELATION_MAP[value] ?? value.toLowerCase()
}

function toRelationEntry(node: ALMedia): { mal_id: number; type: string; name: string; url: string } | null {
  if (node.idMal == null) return null
  return {
    mal_id: node.idMal,
    type: (node.type ?? 'ANIME').toLowerCase(), // page keeps only === 'anime'
    name: node.title?.english ?? node.title?.romaji ?? '',
    url: `https://myanimelist.net/anime/${node.idMal}`,
  }
}

/** Detail node → JikanAnimeFull (relations grouped one-per-edge, like Jikan). */
export function toJikanFull(m: ALMedia): JikanAnimeFull {
  const base = toJikanAnime(m)
  if (!base) throw new ApiError('not-found', 'Not found', 404) // caller guards idMal first
  return {
    ...base,
    relations: (m.relations?.edges ?? []).flatMap((edge) => {
      const entry = edge.node ? toRelationEntry(edge.node) : null
      return entry ? [{ relation: mapRelation(edge.relationType), entry: [entry] }] : []
    }),
    // AniList has no MAL external-link list; `url` already points at MAL
    // and the details page's External meta row reads it directly.
    external: undefined,
    streaming: null, // no equivalent — Watch section hides when empty
  }
}

/** Characters connection → Jikan entries with flattened Japanese voices. */
export function toCharacters(m: ALMedia | null): JikanCharacterEntry[] {
  return (m?.characters?.edges ?? []).flatMap((edge) => {
    if (!edge.node) return []
    const role =
      edge.role === 'MAIN' ? 'Main' : edge.role === 'BACKGROUND' ? 'Background' : 'Supporting'
    const voices: JikanVoiceActor[] = (edge.voiceActors ?? []).map((va) => ({
      mal_id: va.id,
      url: `https://anilist.co/staff/${va.id}`,
      images: { jpg: { image_url: va.image?.large ?? undefined } },
      name: va.name.full,
    }))
    return [
      {
        character: {
          mal_id: edge.node.id, // AniList id — React key only (no /character route)
          url: `https://anilist.co/character/${edge.node.id}`,
          images: { jpg: { image_url: edge.node.image?.large ?? undefined } },
          name: edge.node.name.full,
          name_kanji: edge.node.name.native ?? null,
        },
        role,
        voices,
      },
    ]
  })
}

/** Recommendations nodes → Jikan recommendation pairs (entry carries full card fields). */
export function toRecommendations(m: ALMedia | null, perPage: number): JikanRecommendation[] {
  const nodes = m?.recommendations?.nodes ?? []
  const out: JikanRecommendation[] = []
  for (const node of nodes) {
    if (out.length >= perPage) break
    const media = node.mediaRecommendation
    if (!media || media.idMal == null) continue
    const anime = toJikanAnime(media)
    if (!anime) continue
    out.push({ entry: anime, recommendation: '' })
  }
  return out
}

/**
 * Page envelope → Jikan pagination.
 * AniList caps page-1 totals at 5000 (refines only past the end), so a
 * capped total is reported as 0 = "unknown"; the UI falls back to the
 * loaded count instead of claiming 5000 results.
 */
export function toEnvelope<T>(data: T[], pageInfo: ALPageInfo, perPage: number): JikanEnvelope<T> {
  const total = pageInfo.total ?? 0
  return {
    data,
    pagination: {
      current_page: pageInfo.currentPage,
      last_visible_page: pageInfo.hasNextPage ? pageInfo.currentPage + 1 : pageInfo.currentPage,
      has_next_page: pageInfo.hasNextPage ?? false,
      items: {
        count: data.length,
        total: total >= 5000 ? 0 : total,
        per_page: perPage,
      },
    },
  }
}

/** Same 5000-cap rule for the flat search/browse result shape. */
export function cappedTotal(pageInfo: ALPageInfo): number {
  const total = pageInfo.total ?? 0
  return total >= 5000 ? 0 : total
}

/** Common: drop entries without a MAL id (their detail route wouldn't resolve). */
export function keepMapped(list: ALMedia[]): JikanAnime[] {
  return list.flatMap((m) => {
    const mapped = toJikanAnime(m)
    return mapped ? [mapped] : []
  })
}
