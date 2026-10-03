/**
 * Shared shapes for locally persisted data (localStorage).
 */

export interface WatchHistoryEntry {
  animeId: number
  title: string
  /** English title when available — used for display fallbacks. */
  titleEnglish?: string | null
  posterUrl?: string | null
  episode: number
  episodeTitle?: string | null
  /** Epoch ms of the last watch action. */
  lastWatchedAt: number
  /** Playback progress 0–100 (percent) when a real player reports it. */
  progress?: number
  /** Playback position in seconds when a real player reports it. */
  position?: number
  /** Episode count if known — renders progress like "7 / 12". */
  totalEpisodes?: number | null
}

export interface FavoriteEntry {
  animeId: number
  title: string
  titleEnglish?: string | null
  posterUrl?: string | null
  score?: number | null
  addedAt: number
}

export interface RecentlyViewedEntry {
  animeId: number
  title: string
  posterUrl?: string | null
  viewedAt: number
}
