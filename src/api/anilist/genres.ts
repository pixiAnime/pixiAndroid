/**
 * Static MyAnimeList genre list — snapshot of Jikan GET /genres/anime
 * (78 entries), plus how each name maps onto AniList's smaller genre list.
 *
 * Serves two purposes:
 * 1. getGenres() fallback — discovery-page chips keep working while Jikan is
 *    down (same mal_id → /browse?genres=<id> contract as the live endpoint);
 * 2. translation of the URL's `?genres=<mal_id>,...` csv into AniList's
 *    `genre_in` (AniList genre) / `tag_in` (AniList tag) filters — AniList
 *    doesn't know many MAL genres as genres (Isekai is a tag there), and an
 *    unknown name inside `genre_in` yields zero results, so 'none' rows are
 *    dropped instead of sent.
 *
 * Kinds were probed live against graphql.anilist.co (single-name filters,
 * matched variable names); every 'none' row was re-probed on both sides.
 */
import type { JikanGenre } from "@/api/jikan/types";

/** Snapshot of /genres/anime — mal_id, name, url, count. */
export const MAL_GENRES: JikanGenre[] = [
  {
    mal_id: 1,
    name: "Action",
    url: "https://myanimelist.net/anime/genre/1/Action",
    count: 5003,
  },
  {
    mal_id: 2,
    name: "Adventure",
    url: "https://myanimelist.net/anime/genre/2/Adventure",
    count: 4600,
  },
  {
    mal_id: 5,
    name: "Avant Garde",
    url: "https://myanimelist.net/anime/genre/5/Avant_Garde",
    count: 1122,
  },
  {
    mal_id: 46,
    name: "Award Winning",
    url: "https://myanimelist.net/anime/genre/46/Award_Winning",
    count: 259,
  },
  {
    mal_id: 28,
    name: "Boys Love",
    url: "https://myanimelist.net/anime/genre/28/Boys_Love",
    count: 204,
  },
  {
    mal_id: 4,
    name: "Comedy",
    url: "https://myanimelist.net/anime/genre/4/Comedy",
    count: 7995,
  },
  {
    mal_id: 8,
    name: "Drama",
    url: "https://myanimelist.net/anime/genre/8/Drama",
    count: 3172,
  },
  {
    mal_id: 10,
    name: "Fantasy",
    url: "https://myanimelist.net/anime/genre/10/Fantasy",
    count: 6245,
  },
  {
    mal_id: 26,
    name: "Girls Love",
    url: "https://myanimelist.net/anime/genre/26/Girls_Love",
    count: 129,
  },
  {
    mal_id: 47,
    name: "Gourmet",
    url: "https://myanimelist.net/anime/genre/47/Gourmet",
    count: 261,
  },
  {
    mal_id: 14,
    name: "Horror",
    url: "https://myanimelist.net/anime/genre/14/Horror",
    count: 611,
  },
  {
    mal_id: 7,
    name: "Mystery",
    url: "https://myanimelist.net/anime/genre/7/Mystery",
    count: 1036,
  },
  {
    mal_id: 22,
    name: "Romance",
    url: "https://myanimelist.net/anime/genre/22/Romance",
    count: 2307,
  },
  {
    mal_id: 24,
    name: "Sci-Fi",
    url: "https://myanimelist.net/anime/genre/24/Sci-Fi",
    count: 3585,
  },
  {
    mal_id: 36,
    name: "Slice of Life",
    url: "https://myanimelist.net/anime/genre/36/Slice_of_Life",
    count: 1288,
  },
  {
    mal_id: 30,
    name: "Sports",
    url: "https://myanimelist.net/anime/genre/30/Sports",
    count: 838,
  },
  {
    mal_id: 37,
    name: "Supernatural",
    url: "https://myanimelist.net/anime/genre/37/Supernatural",
    count: 1580,
  },
  {
    mal_id: 41,
    name: "Suspense",
    url: "https://myanimelist.net/anime/genre/41/Suspense",
    count: 481,
  },
  {
    mal_id: 9,
    name: "Ecchi",
    url: "https://myanimelist.net/anime/genre/9/Ecchi",
    count: 828,
  },
  {
    mal_id: 49,
    name: "Erotica",
    url: "https://myanimelist.net/anime/genre/49/Erotica",
    count: 95,
  },
  {
    mal_id: 12,
    name: "Hentai",
    url: "https://myanimelist.net/anime/genre/12/Hentai",
    count: 1634,
  },
  {
    mal_id: 50,
    name: "Adult Cast",
    url: "https://myanimelist.net/anime/genre/50/Adult_Cast",
    count: 798,
  },
  {
    mal_id: 51,
    name: "Anthropomorphic",
    url: "https://myanimelist.net/anime/genre/51/Anthropomorphic",
    count: 1377,
  },
  {
    mal_id: 52,
    name: "CGDCT",
    url: "https://myanimelist.net/anime/genre/52/CGDCT",
    count: 264,
  },
  {
    mal_id: 53,
    name: "Childcare",
    url: "https://myanimelist.net/anime/genre/53/Childcare",
    count: 76,
  },
  {
    mal_id: 54,
    name: "Combat Sports",
    url: "https://myanimelist.net/anime/genre/54/Combat_Sports",
    count: 104,
  },
  {
    mal_id: 81,
    name: "Crossdressing",
    url: "https://myanimelist.net/anime/genre/81/Crossdressing",
    count: 68,
  },
  {
    mal_id: 55,
    name: "Delinquents",
    url: "https://myanimelist.net/anime/genre/55/Delinquents",
    count: 79,
  },
  {
    mal_id: 39,
    name: "Detective",
    url: "https://myanimelist.net/anime/genre/39/Detective",
    count: 260,
  },
  {
    mal_id: 56,
    name: "Educational",
    url: "https://myanimelist.net/anime/genre/56/Educational",
    count: 368,
  },
  {
    mal_id: 57,
    name: "Gag Humor",
    url: "https://myanimelist.net/anime/genre/57/Gag_Humor",
    count: 321,
  },
  {
    mal_id: 58,
    name: "Gore",
    url: "https://myanimelist.net/anime/genre/58/Gore",
    count: 282,
  },
  {
    mal_id: 35,
    name: "Harem",
    url: "https://myanimelist.net/anime/genre/35/Harem",
    count: 499,
  },
  {
    mal_id: 59,
    name: "High Stakes Game",
    url: "https://myanimelist.net/anime/genre/59/High_Stakes_Game",
    count: 63,
  },
  {
    mal_id: 13,
    name: "Historical",
    url: "https://myanimelist.net/anime/genre/13/Historical",
    count: 1877,
  },
  {
    mal_id: 60,
    name: "Idols (Female)",
    url: "https://myanimelist.net/anime/genre/60/Idols_Female",
    count: 417,
  },
  {
    mal_id: 61,
    name: "Idols (Male)",
    url: "https://myanimelist.net/anime/genre/61/Idols_Male",
    count: 177,
  },
  {
    mal_id: 62,
    name: "Isekai",
    url: "https://myanimelist.net/anime/genre/62/Isekai",
    count: 510,
  },
  {
    mal_id: 63,
    name: "Iyashikei",
    url: "https://myanimelist.net/anime/genre/63/Iyashikei",
    count: 188,
  },
  {
    mal_id: 64,
    name: "Love Polygon",
    url: "https://myanimelist.net/anime/genre/64/Love_Polygon",
    count: 111,
  },
  {
    mal_id: 65,
    name: "Magical Sex Shift",
    url: "https://myanimelist.net/anime/genre/65/Magical_Sex_Shift",
    count: 34,
  },
  {
    mal_id: 66,
    name: "Mahou Shoujo",
    url: "https://myanimelist.net/anime/genre/66/Mahou_Shoujo",
    count: 375,
  },
  {
    mal_id: 17,
    name: "Martial Arts",
    url: "https://myanimelist.net/anime/genre/17/Martial_Arts",
    count: 792,
  },
  {
    mal_id: 18,
    name: "Mecha",
    url: "https://myanimelist.net/anime/genre/18/Mecha",
    count: 1363,
  },
  {
    mal_id: 67,
    name: "Medical",
    url: "https://myanimelist.net/anime/genre/67/Medical",
    count: 54,
  },
  {
    mal_id: 38,
    name: "Military",
    url: "https://myanimelist.net/anime/genre/38/Military",
    count: 753,
  },
  {
    mal_id: 19,
    name: "Music",
    url: "https://myanimelist.net/anime/genre/19/Music",
    count: 5558,
  },
  {
    mal_id: 6,
    name: "Mythology",
    url: "https://myanimelist.net/anime/genre/6/Mythology",
    count: 565,
  },
  {
    mal_id: 68,
    name: "Organized Crime",
    url: "https://myanimelist.net/anime/genre/68/Organized_Crime",
    count: 119,
  },
  {
    mal_id: 69,
    name: "Otaku Culture",
    url: "https://myanimelist.net/anime/genre/69/Otaku_Culture",
    count: 109,
  },
  {
    mal_id: 20,
    name: "Parody",
    url: "https://myanimelist.net/anime/genre/20/Parody",
    count: 824,
  },
  {
    mal_id: 70,
    name: "Performing Arts",
    url: "https://myanimelist.net/anime/genre/70/Performing_Arts",
    count: 162,
  },
  {
    mal_id: 71,
    name: "Pets",
    url: "https://myanimelist.net/anime/genre/71/Pets",
    count: 153,
  },
  {
    mal_id: 40,
    name: "Psychological",
    url: "https://myanimelist.net/anime/genre/40/Psychological",
    count: 481,
  },
  {
    mal_id: 3,
    name: "Racing",
    url: "https://myanimelist.net/anime/genre/3/Racing",
    count: 232,
  },
  {
    mal_id: 72,
    name: "Reincarnation",
    url: "https://myanimelist.net/anime/genre/72/Reincarnation",
    count: 181,
  },
  {
    mal_id: 73,
    name: "Reverse Harem",
    url: "https://myanimelist.net/anime/genre/73/Reverse_Harem",
    count: 81,
  },
  {
    mal_id: 74,
    name: "Love Status Quo",
    url: "https://myanimelist.net/anime/genre/74/Love_Status_Quo",
    count: 47,
  },
  {
    mal_id: 21,
    name: "Samurai",
    url: "https://myanimelist.net/anime/genre/21/Samurai",
    count: 253,
  },
  {
    mal_id: 23,
    name: "School",
    url: "https://myanimelist.net/anime/genre/23/School",
    count: 2305,
  },
  {
    mal_id: 75,
    name: "Showbiz",
    url: "https://myanimelist.net/anime/genre/75/Showbiz",
    count: 52,
  },
  {
    mal_id: 29,
    name: "Space",
    url: "https://myanimelist.net/anime/genre/29/Space",
    count: 691,
  },
  {
    mal_id: 11,
    name: "Strategy Game",
    url: "https://myanimelist.net/anime/genre/11/Strategy_Game",
    count: 363,
  },
  {
    mal_id: 31,
    name: "Super Power",
    url: "https://myanimelist.net/anime/genre/31/Super_Power",
    count: 749,
  },
  {
    mal_id: 76,
    name: "Survival",
    url: "https://myanimelist.net/anime/genre/76/Survival",
    count: 85,
  },
  {
    mal_id: 77,
    name: "Team Sports",
    url: "https://myanimelist.net/anime/genre/77/Team_Sports",
    count: 331,
  },
  {
    mal_id: 78,
    name: "Time Travel",
    url: "https://myanimelist.net/anime/genre/78/Time_Travel",
    count: 170,
  },
  {
    mal_id: 32,
    name: "Vampire",
    url: "https://myanimelist.net/anime/genre/32/Vampire",
    count: 182,
  },
  {
    mal_id: 79,
    name: "Video Game",
    url: "https://myanimelist.net/anime/genre/79/Video_Game",
    count: 188,
  },
  {
    mal_id: 80,
    name: "Visual Arts",
    url: "https://myanimelist.net/anime/genre/80/Visual_Arts",
    count: 100,
  },
  {
    mal_id: 48,
    name: "Workplace",
    url: "https://myanimelist.net/anime/genre/48/Workplace",
    count: 247,
  },
  {
    mal_id: 82,
    name: "Urban Fantasy",
    url: "https://myanimelist.net/anime/genre/82/Urban_Fantasy",
    count: 243,
  },
  {
    mal_id: 83,
    name: "Villainess",
    url: "https://myanimelist.net/anime/genre/83/Villainess",
    count: 31,
  },
  {
    mal_id: 43,
    name: "Josei",
    url: "https://myanimelist.net/anime/genre/43/Josei",
    count: 161,
  },
  {
    mal_id: 15,
    name: "Kids",
    url: "https://myanimelist.net/anime/genre/15/Kids",
    count: 7081,
  },
  {
    mal_id: 42,
    name: "Seinen",
    url: "https://myanimelist.net/anime/genre/42/Seinen",
    count: 1207,
  },
  {
    mal_id: 25,
    name: "Shoujo",
    url: "https://myanimelist.net/anime/genre/25/Shoujo",
    count: 545,
  },
  {
    mal_id: 27,
    name: "Shounen",
    url: "https://myanimelist.net/anime/genre/27/Shounen",
    count: 2279,
  },
];

export type AnilistGenreKind = "genre" | "tag" | "none";

/**
 * How AniList accepts each MAL genre name when filtering:
 * 'genre' → send in `genre_in`, 'tag' → send in `tag_in`, 'none' → drop
 * (no AniList equivalent under that name). MAL 41 (Suspense) is overridden
 * to 'genre' — AniList calls it Thriller (probed live).
 */
export const MAL_GENRE_KIND: Record<number, AnilistGenreKind> = {
  "1": "genre",
  "2": "genre",
  "5": "none",
  "46": "none",
  "28": "none",
  "4": "genre",
  "8": "genre",
  "10": "genre",
  "26": "none",
  "47": "none",
  "14": "genre",
  "7": "genre",
  "22": "genre",
  "24": "genre",
  "36": "genre",
  "30": "genre",
  "37": "genre",
  "41": "genre",
  "9": "genre",
  "49": "none",
  "12": "genre",
  "50": "none",
  "51": "none",
  "52": "none",
  "53": "none",
  "54": "none",
  "81": "tag",
  "55": "tag",
  "39": "tag",
  "56": "tag",
  "57": "none",
  "58": "tag",
  "35": "none",
  "59": "none",
  "13": "tag",
  "60": "none",
  "61": "none",
  "62": "tag",
  "63": "tag",
  "64": "none",
  "65": "none",
  "66": "genre",
  "17": "tag",
  "18": "genre",
  "67": "none",
  "38": "tag",
  "19": "genre",
  "6": "tag",
  "68": "none",
  "69": "tag",
  "20": "tag",
  "70": "none",
  "71": "none",
  "40": "genre",
  "3": "none",
  "72": "tag",
  "73": "none",
  "74": "none",
  "21": "tag",
  "23": "tag",
  "75": "none",
  "29": "tag",
  "11": "none",
  "31": "tag",
  "76": "tag",
  "77": "none",
  "78": "none",
  "32": "tag",
  "79": "none",
  "80": "none",
  "48": "none",
  "82": "tag",
  "83": "tag",
  "43": "tag",
  "15": "tag",
  "42": "tag",
  "25": "tag",
  "27": "tag",
};

/**
 * MAL id → the name AniList accepts, where the labels differ
 * (MAL "Suspense" is AniList's "Thriller").
 */
const AL_NAME_OVERRIDES: Record<number, string> = { 41: "Thriller" };

/** Reverse of AL_NAME_OVERRIDES — map AniList genre names back to MAL. */
const MAL_NAME_BY_AL_NAME: Record<string, string> = { Thriller: "Suspense" };

const BY_NAME = new Map(MAL_GENRES.map((g) => [g.name.toLowerCase(), g]));
const BY_ID = new Map(MAL_GENRES.map((g) => [g.mal_id, g]));

function malGenreByName(name: string): JikanGenre | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

/**
 * Resolve an AniList genre/tag name to its MAL genre — AniList labels a few
 * genres differently (Thriller → Suspense), so genre chips built from
 * AniList data still carry the right MAL id and browse link.
 */
export function malGenreByAlName(name: string): JikanGenre | undefined {
  const direct = malGenreByName(name);
  if (direct) return direct;
  const malName = MAL_NAME_BY_AL_NAME[name.trim()];
  return malName ? malGenreByName(malName) : undefined;
}

/**
 * Translate the URL's `?genres=<mal_id>,...` csv into AniList filter args.
 * Unsupported names are dropped; AniList ANDs genre_in/tag_in together, so
 * the remaining constraints still apply exactly.
 */
export function splitGenreIds(csv?: string | null): {
  genreIn: string[];
  tagIn: string[];
} {
  const genreIn: string[] = [];
  const tagIn: string[] = [];
  if (!csv) return { genreIn, tagIn };
  for (const part of csv.split(",")) {
    const id = Number(part.trim());
    if (!Number.isInteger(id)) continue;
    const kind = MAL_GENRE_KIND[id];
    if (kind !== "genre" && kind !== "tag") continue;
    const name = AL_NAME_OVERRIDES[id] ?? BY_ID.get(id)?.name;
    if (!name) continue;
    if (kind === "genre") genreIn.push(name);
    else tagIn.push(name);
  }
  return { genreIn, tagIn };
}
