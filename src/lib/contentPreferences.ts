/**
 * Content display preferences — which title to show, and whether adult titles
 * are hidden (mobile-owned).
 *
 * These are presentation-only choices applied at the mobile call sites that
 * render an anime row or card. The shared API/query layer is untouched, so a
 * preference can never change what is fetched, only what is drawn.
 *
 * Storage follows the same defensive pattern as `playerPrefs`: reads never
 * throw, a value written by a future build falls back to the default.
 */

const TITLE_LANGUAGE_KEY = 'pixiandroid.content.titleLanguage'
const HIDE_ADULT_KEY = 'pixiandroid.content.hideAdult'

export const TITLE_LANGUAGES = ['en', 'romaji', 'native'] as const
export type TitleLanguage = (typeof TITLE_LANGUAGES)[number]

export function isTitleLanguage(value: unknown): value is TitleLanguage {
  return (TITLE_LANGUAGES as readonly string[]).includes(value as string)
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* read-only store — the preference still applies for this session */
  }
}

/** Which title field the UI should prefer. Defaults to English. */
export function readTitleLanguage(): TitleLanguage {
  const value = read(TITLE_LANGUAGE_KEY)
  return isTitleLanguage(value) ? value : 'en'
}

export function writeTitleLanguage(value: TitleLanguage): void {
  write(TITLE_LANGUAGE_KEY, value)
}

/** Hide hentai / adult-rated titles from lists. Off by default. */
export function readHideAdult(): boolean {
  return read(HIDE_ADULT_KEY) === 'true'
}

export function writeHideAdult(value: boolean): void {
  write(HIDE_ADULT_KEY, value ? 'true' : 'false')
}

/** The title fields any caller of `pickTitle` may hold (Jikan + stored). */
export interface TitleFields {
  title?: string | null
  title_english?: string | null
  title_japanese?: string | null
}

/**
 * The title to show for `language`. Falls back through the other fields when
 * the preferred one is absent, and finally to an empty string so callers can
 * chain a `?? '—'` if they want.
 */
export function pickTitle(
  anime: TitleFields,
  language: TitleLanguage = readTitleLanguage(),
): string {
  const english = anime.title_english?.trim() || ''
  const romaji = anime.title?.trim() || ''
  const native = anime.title_japanese?.trim() || ''
  switch (language) {
    case 'romaji':
      return romaji || english || native
    case 'native':
      return native || english || romaji
    default:
      return english || romaji || native
  }
}

/** Same choice for a stored entry that keeps `title` (romaji) + `titleEnglish`. */
export function pickStoredTitle(
  entry: { title?: string | null; titleEnglish?: string | null },
  language: TitleLanguage = readTitleLanguage(),
): string {
  const english = entry.titleEnglish?.trim() || ''
  const romaji = entry.title?.trim() || ''
  switch (language) {
    case 'romaji':
      return romaji || english
    case 'native':
      return romaji || english
    default:
      return english || romaji
  }
}

/** Fields `isAdultContent` reads — Jikan's `rating` and `genres`. */
export interface AdultFields {
  rating?: string | null
  genres?: { name?: string }[] | null
}

/** True for hentai / adult-rated titles (Jikan `Rx - Hentai` or genre Hentai). */
export function isAdultContent(anime: AdultFields): boolean {
  const rating = anime.rating?.trim().toLowerCase() ?? ''
  if (rating.startsWith('rx')) return true
  if (anime.genres?.some((genre) => genre.name?.trim().toLowerCase() === 'hentai')) return true
  return false
}

/**
 * Array filter for lists: drops adult entries when hiding is on. Reads the
 * preference once so a caller filtering a whole page pays for one storage read.
 */
export function filterAdult<T extends AdultFields>(items: T[], hide = readHideAdult()): T[] {
  return hide ? items.filter((item) => !isAdultContent(item)) : items
}
