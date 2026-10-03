/**
 * Episode provider abstraction — episode METADATA only.
 *
 * Playback does not live here: streaming/subtitle sources come from the
 * extension runtime (src/extensions) via the Watch page. `getEpisodes` is
 * backed by Jikan, with a synthetic numbered fallback when Jikan has no
 * per-episode data for a title.
 */

export interface Episode {
  /** 1-based episode number. */
  number: number
  title?: string | null
  titleJapanese?: string | null
  /** ISO date when known. */
  airDate?: string | null
  filler?: boolean
  recap?: boolean
}

export interface EpisodeList {
  animeId: number
  episodes: Episode[]
  page: number
  hasNextPage: boolean
  /** Total episodes for the anime when known (detail metadata). */
  total?: number | null
}

export interface EpisodeProvider {
  /** Stable id — surfaced in the UI for debugging. */
  readonly id: string
  /** Episode metadata (number/title/air date). Never throws for "no source". */
  getEpisodes(
    animeId: number,
    options?: { page?: number; totalEpisodes?: number | null; signal?: AbortSignal },
  ): Promise<EpisodeList>
}
