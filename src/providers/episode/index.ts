/**
 * Default EpisodeProvider — episode metadata from Jikan (playback sources
 * come from the extension runtime, not from here).
 */
import jikanEpisodeProvider from './jikanEpisodeProvider'
import type { EpisodeProvider } from './types'

export const episodeProvider: EpisodeProvider = {
  id: jikanEpisodeProvider.id,

  getEpisodes: (animeId, options) => jikanEpisodeProvider.getEpisodes(animeId, options),
}

export type { Episode, EpisodeList, EpisodeProvider } from './types'
