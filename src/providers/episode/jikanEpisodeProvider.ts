/**
 * Jikan-backed episode metadata.
 *
 * - getEpisodes: Jikan /anime/{id}/episodes; when Jikan has no per-episode
 *   data (some older titles), falls back to a synthetic numbered list derived
 *   from the anime's episode count so the UI always works.
 */
import { getAnimeEpisodes } from '@/api/jikan/endpoints'
import { ApiError } from '@/api/errors'
import type { Episode, EpisodeProvider } from './types'

const jikanEpisodeProvider: EpisodeProvider = {
  id: 'jikan',

  async getEpisodes(animeId, options = {}) {
    const { page = 1, totalEpisodes, signal } = options

    try {
      const res = await getAnimeEpisodes(animeId, { page, signal })
      const episodes: Episode[] = res.data.map((ep) => ({
        number: ep.mal_id,
        title: ep.title ?? null,
        titleJapanese: ep.title_japanese ?? null,
        airDate: ep.aired ?? null,
        filler: ep.filler,
        recap: ep.recap,
      }))

      if (episodes.length > 0) {
        return {
          animeId,
          episodes,
          page: res.pagination.current_page ?? page,
          hasNextPage: res.pagination.has_next_page,
          total: totalEpisodes ?? null,
        }
      }
    } catch (error) {
      // 404 / bad request → fall through to synthetic list.
      if (!(error instanceof ApiError) || error.kind === 'network' || error.kind === 'server') {
        throw error
      }
    }

    // Synthetic fallback: numbered episodes from the detail's episode count.
    const total = totalEpisodes ?? 0
    if (total > 0) {
      const perPage = 100
      const start = (page - 1) * perPage + 1
      const end = Math.min(page * perPage, total)
      const episodes: Episode[] = []
      for (let n = start; n <= end; n++) episodes.push({ number: n })
      return {
        animeId,
        episodes,
        page,
        hasNextPage: end < total,
        total,
      }
    }

    return { animeId, episodes: [], page: 1, hasNextPage: false, total: totalEpisodes ?? null }
  },
}

export default jikanEpisodeProvider
