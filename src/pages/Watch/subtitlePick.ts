/**
 * Which subtitle track an episode opens on.
 *
 * Pure on purpose: the rules are language matching, not I/O, so they are unit
 * tested without a renderer (`tests/subtitlePick.test.ts`).
 *
 * The order is deliberate and answers the viewer's question "why is this
 * caption in a language I did not ask for?":
 *
 *  1. **the app's own language.** The viewer runs the app in Türkçe; an episode
 *     that has Turkish captions opens on them, whatever the provider flagged.
 *  2. **the provider's `default`.** Only when there is no match for the app —
 *     the provider knows its own streams better than we do.
 *  3. **nothing.** Subtitles stay off rather than guessing. A viewer who turned
 *     them off, or who deliberately picked a track, is not overridden.
 *
 * Matching is on the *base* language (`pt-BR` and `pt` are the same choice) and
 * is case-insensitive, because nothing in `SubtitleSource.language` is
 * normalised by the providers. The alias table covers the ISO 639-2/3 spellings
 * that show up in the wild: an extension that labels Turkish `tur` still
 * matches an app that says `tr`.
 */

/** The subset of a subtitle track this decision needs. */
export interface PickableSubtitle {
  key: string
  /** A language tag as the provider sent it — `tr`, `tur`, `pt-BR`, `en-US`. */
  language: string
  /** Provider-flagged "play this one by default". */
  default?: boolean
}

/**
 * Codes each of the app's languages also travels under in ISO 639-2/3.
 * Only the languages the app ships (en/tr/ru) are listed — the table is for
 * bridging *our* names to theirs, not for cataloguing the standards.
 */
const LANGUAGE_ALIASES: Record<string, readonly string[]> = {
  en: ['eng'],
  tr: ['tur'],
  ru: ['rus'],
}

/** `pt-BR` / `pt_BR` / `PT` → `pt`. */
function baseLanguage(code: string): string {
  const [base = ''] = code.split(/[-_]/i)
  return base.toLowerCase()
}

/** True when two language tags name the same language. */
export function sameLanguage(a: string, b: string): boolean {
  const left = baseLanguage(a)
  const right = baseLanguage(b)
  if (!left || !right) return false
  if (left === right) return true
  return (
    (LANGUAGE_ALIASES[left] ?? []).includes(right) ||
    (LANGUAGE_ALIASES[right] ?? []).includes(left)
  )
}

/**
 * The track to open on, or `null` to leave subtitles off.
 *
 * `language` is the app's current language (`i18n.resolvedLanguage`); a
 * `null`/`undefined` means "no preference", which drops straight through to the
 * provider's own default.
 */
export function pickInitialSubtitle(
  subtitles: readonly PickableSubtitle[],
  language: string | null | undefined,
): string | null {
  if (language) {
    const match = subtitles.find((subtitle) => sameLanguage(subtitle.language, language))
    if (match) return match.key
  }
  const fallback = subtitles.find((subtitle) => subtitle.default === true)
  return fallback?.key ?? null
}