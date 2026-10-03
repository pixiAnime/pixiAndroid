/**
 * GraphQL documents for the AniList fallback — every query validated live
 * against graphql.anilist.co (field names, enum values, variable types).
 *
 * Variable types matter: the season scalar is `MediaSeason`, not `Season`,
 * and `UPDATED_DESC` is invalid — the enum is `UPDATED_AT_DESC`.
 */

const MEDIA_FIELDS = `
  id idMal type format status source
  title { romaji english native }
  synonyms
  episodes duration season seasonYear
  startDate { year month day }
  endDate { year month day }
  genres meanScore popularity favourites
  rankings { rank context }
  description(asHtml: false)
  coverImage { extraLarge large medium }
  bannerImage
  studios { nodes { id name } }
  nextAiringEpisode { episode }
`

const MEDIA_SUMMARY = `
  id idMal type
  title { romaji english native }
  coverImage { extraLarge large medium }
`

/** Shared list surface: top / seasons / recently-updated / search / browse. */
export const ANILIST_LIST_QUERY = `
  query MediaList(
    $page: Int, $perPage: Int, $search: String, $sort: [MediaSort],
    $status: MediaStatus, $format: MediaFormat, $season: MediaSeason,
    $seasonYear: Int, $genreIn: [String], $tagIn: [String]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage total }
      media(
        type: ANIME, search: $search, sort: $sort, status: $status,
        format: $format, season: $season, seasonYear: $seasonYear,
        genre_in: $genreIn, tag_in: $tagIn
      ) {
        ...MediaFields
      }
    }
  }
  fragment MediaFields on Media { ${MEDIA_FIELDS} }
`

/** Detail by MAL id (AniList stores `idMal` for every mirrored title). */
export const ANILIST_DETAIL_QUERY = `
  query MediaDetail($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      ...MediaFields
      relations {
        edges { relationType node { ...MediaSummary } }
      }
    }
  }
  fragment MediaFields on Media { ${MEDIA_FIELDS} }
  fragment MediaSummary on Media { ${MEDIA_SUMMARY} }
`

export const ANILIST_CHARACTERS_QUERY = `
  query MediaCharacters($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      characters(sort: RELEVANCE, perPage: 25) {
        edges {
          role
          node { id name { full native } image { large } }
          voiceActors(language: JAPANESE) { id name { full } image { large } }
        }
      }
    }
  }
`

export const ANILIST_RECOMMENDATIONS_QUERY = `
  query MediaRecommendations($idMal: Int, $perPage: Int) {
    Media(idMal: $idMal, type: ANIME) {
      recommendations(sort: RATING, perPage: $perPage) {
        nodes { mediaRecommendation { ...MediaFields } }
      }
    }
  }
  fragment MediaFields on Media { ${MEDIA_FIELDS} }
`

/**
 * Reverse id lookup: MAL → AniList. Jikan doesn't carry the AniList id, so
 * the extension system resolves it here once per anime (cached query).
 */
export const ANILIST_ID_BY_MAL_QUERY = `
  query MediaIdByMal($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) { id }
  }
`
