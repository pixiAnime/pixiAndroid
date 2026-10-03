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
 *
 * Two guards sit on top of the ordering, both in `nextSubtitleSelection`: a
 * track is only picked if it can be *drawn* (ASS is metadata-only here), and a
 * provisional pick is replaced the moment the app's own language shows up —
 * the subtitle query re-runs once the AniList id resolves, so the first list
 * to arrive is often a stopgap rather than the answer.
 */

/** The subset of a subtitle track this decision needs. */
export interface PickableSubtitle {
  key: string
  /** A language tag as the provider sent it — `tr`, `tur`, `pt-BR`, `en-US`. */
  language: string
  /** Provider-flagged "play this one by default". */
  default?: boolean
  /**
   * Container format as the extension layer normalized it.
   *
   * `ass` is load-bearing here: the cues never render (`resolveSubtitleTrack`
   * refuses the format) *and* the settings menu filters it out, so a track
   * that is picked automatically but never listed reads to the viewer as
   * "subtitles were not selected at all". An automatic choice must therefore
   * skip it.
   */
  format?: string
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
 *
 * Only tracks that can actually be drawn are candidates — see
 * `PickableSubtitle.format`.
 */
export function pickInitialSubtitle(
  subtitles: readonly PickableSubtitle[],
  language: string | null | undefined,
): string | null {
  const candidates = subtitles.filter((subtitle) => subtitle.format !== 'ass')
  if (language) {
    const match = candidates.find((subtitle) => sameLanguage(subtitle.language, language))
    if (match) return match.key
  }
  const fallback = candidates.find((subtitle) => subtitle.default === true)
  return fallback?.key ?? null
}

/**
 * What the selection should become, given everything the page knows about it.
 *
 * The rule the caller needs is *patience*: the subtitle query re-runs once the
 * AniList id resolves (its key carries that id), so the first list to arrive
 * can be a stopgap — a provider's English default, say — while the archive
 * that holds the Turkish tracks answers a moment later. A stopgap must not
 * become final, or the app's own language never wins. So:
 *
 *  1. **a deliberate choice is final.** `manual` is set the moment the viewer
 *     touches the track list; nothing automatic overrides it, including
 *     turning subtitles off.
 *  2. **the app's language wins whenever it shows up** — replacing whatever
 *     provisional track is on screen.
 *  3. **an empty list is not a decision.** While a query re-runs the list is
 *     briefly empty; clearing then would blink subtitles off mid-episode, so
 *     the current choice stands.
 *
 * Returns the value to store — equal to `current` when nothing should change.
 */
export function nextSubtitleSelection(state: {
  /** What is selected now (may be `null`). */
  current: string | null
  /** The viewer picked — or turned off — the track themselves. */
  manual: boolean
  subtitles: readonly PickableSubtitle[]
  /** The app's current language, as `pickInitialSubtitle` wants it. */
  language: string | null | undefined
}): string | null {
  const { current, manual, subtitles, language } = state
  if (manual) return current
  const preferred = pickInitialSubtitle(subtitles, language)
  return preferred ?? current
}