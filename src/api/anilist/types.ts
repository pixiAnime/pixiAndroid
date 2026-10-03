/**
 * AniList GraphQL response shapes — only the fields the mapper consumes.
 * All shapes validated live against graphql.anilist.co.
 */

export interface ALDate {
  year?: number | null
  month?: number | null
  day?: number | null
}

export interface ALTitle {
  romaji?: string | null
  english?: string | null
  native?: string | null
}

export interface ALCover {
  extraLarge?: string | null
  large?: string | null
  medium?: string | null
}

export interface ALRanking {
  rank: number
  context?: string | null
}

export interface ALStudio {
  id: number
  name: string
}

export interface ALVoiceActor {
  id: number
  name: { full: string }
  image?: { large?: string | null } | null
}

export interface ALCharacterEdge {
  role?: string | null
  node: {
    id: number
    name: { full: string; native?: string | null }
    image?: { large?: string | null } | null
  }
  voiceActors?: ALVoiceActor[] | null
}

export interface ALRelationEdge {
  relationType: string
  node: ALMedia | null
}

/** Recursive: recommendations point at other Media nodes. */
export interface ALMedia {
  id: number
  idMal?: number | null
  type?: string | null
  format?: string | null
  status?: string | null
  source?: string | null
  title: ALTitle
  synonyms?: (string | null)[] | null
  episodes?: number | null
  duration?: number | null
  season?: string | null
  seasonYear?: number | null
  startDate?: ALDate | null
  endDate?: ALDate | null
  genres?: (string | null)[] | null
  meanScore?: number | null
  popularity?: number | null
  favourites?: number | null
  rankings?: ALRanking[] | null
  description?: string | null
  coverImage?: ALCover | null
  bannerImage?: string | null
  studios?: { nodes: ALStudio[] } | null
  nextAiringEpisode?: { episode: number } | null
  relations?: { edges: ALRelationEdge[] } | null
  characters?: { edges: ALCharacterEdge[] } | null
  recommendations?: { nodes: { mediaRecommendation: ALMedia | null }[] | null } | null
}

export interface ALPageInfo {
  currentPage: number
  /** Page-1 totals are capped at 5000 by AniList; may be absent/null. */
  total?: number | null
  hasNextPage?: boolean | null
}

export interface ALPage {
  Page: {
    pageInfo: ALPageInfo
    media: ALMedia[]
  }
}

export interface ALMediaResponse {
  Media: ALMedia | null
}

/** GraphQL errors arrive with HTTP 200 — `status` carries the real code. */
export interface ALErrorPayload {
  errors?: { message?: string; status?: number; extensions?: { code?: string } }[]
  data?: unknown
}
