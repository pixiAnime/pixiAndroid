/**
 * Raw Jikan v4 response shapes — the subset pixiWeb consumes.
 * Jikan mirrors MAL; only fields we actually read are typed.
 */

export interface JikanImageSet {
  image_url?: string
  small_image_url?: string
  large_image_url?: string
}

export interface JikanImages {
  jpg: JikanImageSet
  webp: JikanImageSet
}

export interface JikanMalName {
  mal_id: number
  type: string
  name: string
  url: string
}

export interface JikanAiredProp {
  from?: { year?: number; month?: number; day?: number }
  to?: { year?: number; month?: number; day?: number }
}

export interface JikanAired {
  from?: string | null
  to?: string | null
  prop?: JikanAiredProp
  string?: string
}

export interface JikanAnime {
  mal_id: number
  url: string
  images: JikanImages
  title: string
  title_english?: string | null
  title_japanese?: string | null
  title_synonyms?: string[]
  type?: string | null
  source?: string
  episodes?: number | null
  status?: string
  airing?: boolean
  aired: JikanAired
  duration?: string
  rating?: string | null
  score?: number | null
  scored_by?: number | null
  rank?: number | null
  popularity?: number | null
  members?: number | null
  favorites?: number | null
  synopsis?: string
  background?: string | null
  season?: string | null
  year?: number | null
  genres?: JikanMalName[]
  themes?: JikanMalName[]
  demographics?: JikanMalName[]
  producers?: JikanMalName[]
  studios?: JikanMalName[]
  licensors?: JikanMalName[]
}

/** /anime/{id}/full */
export interface JikanRelationGroup {
  relation: string
  entry: { mal_id: number; type: string; name: string; url: string }[]
}

export interface JikanAnimeFull extends JikanAnime {
  relations?: JikanRelationGroup[]
  external?: { name: string; url: string }[]
  streaming?: { name: string; url: string }[] | null
}

export interface JikanCharacter {
  mal_id: number
  url: string
  images: { jpg: JikanImageSet }
  name: string
  name_kanji?: string | null
  nicknames?: string[]
}

export interface JikanVoiceActor {
  mal_id: number
  url: string
  images: { jpg: JikanImageSet }
  name: string
}

export interface JikanCharacterEntry {
  character: JikanCharacter
  role: string
  /** Normalized Japanese voice actors (flattened from raw `voice_actors`). */
  voices?: JikanVoiceActor[]
  /** Raw Jikan field: `voice_actors[].person` + language. */
  voice_actors?: { person: JikanVoiceActor; language?: string }[]
}

export interface JikanEpisode {
  mal_id: number
  title?: string | null
  title_japanese?: string | null
  title_romanji?: string | null
  aired?: string | null
  filler?: boolean
  recap?: boolean
  forum_url?: string
  score?: number | null
}

export interface JikanRecommendationEntry {
  mal_id: number
  url: string
  images: JikanImages
  title: string
}

export interface JikanRecommendation {
  entry: JikanRecommendationEntry
  recommendation: string
}

export interface JikanGenre {
  mal_id: number
  name: string
  url: string
  count?: number
  /** Present on /genres/anime in some payloads — "genre" | "theme" | "demographic". */
  type?: string
}

export interface JikanPagination {
  /** Actual page of this response (pagination_plus endpoints). */
  current_page?: number
  last_visible_page: number
  has_next_page: boolean
  items?: { count: number; total: number; per_page: number }
}

/** Every Jikan list endpoint shares this envelope. */
export interface JikanEnvelope<T> {
  data: T[]
  pagination: JikanPagination
}

/** Single-resource endpoints wrap `data` without pagination. */
export interface JikanSingle<T> {
  data: T
}
