/**
 * Request assembly — the stable identity every extension receives
 * (spec §5/§6/§17). Pure: Jikan detail + resolved AniList id in,
 * SourceRequest out.
 */
import type { JikanAnime } from '@/api/jikan/types'
import type { AnimeIdentifiers, SourceRequest } from '../sdk/types.ts'

export function buildSourceRequest(
  anime: JikanAnime,
  episode: number,
  anilistId: number | null,
): SourceRequest {
  const identifiers: AnimeIdentifiers = {
    malId: anime.mal_id,
    anilistId: anilistId ?? undefined,
    titles: {
      english: anime.title_english ?? anime.title ?? undefined,
      romaji: anime.title ?? undefined,
      native: anime.title_japanese ?? undefined,
      synonyms: anime.title_synonyms && anime.title_synonyms.length > 0 ? anime.title_synonyms : undefined,
    },
  }
  return {
    anime: identifiers,
    episode: {
      number: episode,
      absoluteNumber: episode,
      season: 1,
    },
  }
}
