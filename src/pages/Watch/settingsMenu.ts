/**
 * The shape of the player's settings menu.
 *
 * One flat list of every value stops being a menu: speed, display, cue size,
 * nine subtitle tracks, delay, skip, hold speed and autoplay is ~30 rows that
 * have to be scrolled past to reach anything. So the gear opens a **tree** —
 *
 * ```
 * ⚙ Settings
 *   Playback          1× · Fit
 *   Subtitles         Arabic · Medium
 *       ├ Playback → Speed / Display / Skip / Hold speed / Auto next
 *       └ Subtitles → Track / Size / Delay
 * ```
 *
 * — a summary list two taps from any value, and never a screen longer than the
 * longest list in it. This module owns only the *shape* (what page is the
 * parent of what, and how deep things are); the rows, the words and the
 * i18n live in `player/sheet/SettingsSheet.tsx`, so the structure stays
 * testable on its own — and so the tree can be re-dressed (popover → bottom
 * sheet) without touching a single parent link.
 *
 * The invariant the tests pin: every page has a parent, the chain always ends
 * at the root, and nothing is more than two taps from it. A typo in a page
 * name would otherwise strand a screen with no way back out of it.
 */

/** Every page the menu can show. Leaves are the value lists. */
export type SettingsPage =
  | 'root'
  | 'playback'
  | 'subtitles'
  | 'speed'
  | 'display'
  | 'skip'
  | 'hold'
  | 'sleep'
  | 'audio'
  | 'track'
  | 'cueSize'

/** The two lists that group everything else. */
export const SETTINGS_GROUPS = ['playback', 'subtitles'] as const
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number]

/**
 * Pages that are a value list rather than a summary list.
 *
 * `audio` and `sleep` are here for the same reason as the rest: a value lives
 * in a list. They are *rows* that only appear when they apply — audio only
 * when the stream carries more than one audio track, sleep always — so the
 * tree never shows a dead end.
 */
export const SETTINGS_LEAVES = [
  'speed',
  'display',
  'skip',
  'hold',
  'sleep',
  'audio',
  'track',
  'cueSize',
] as const
export type SettingsLeaf = (typeof SETTINGS_LEAVES)[number]

const PARENTS: Record<SettingsPage, SettingsPage | null> = {
  root: null,
  playback: 'root',
  subtitles: 'root',
  speed: 'playback',
  display: 'playback',
  skip: 'playback',
  hold: 'playback',
  sleep: 'playback',
  audio: 'playback',
  track: 'subtitles',
  cueSize: 'subtitles',
}

export const ALL_PAGES = [
  'root',
  ...SETTINGS_GROUPS,
  ...SETTINGS_LEAVES,
] as const satisfies readonly SettingsPage[]

/** The page one level up, or `null` at the root — where the menu closes. */
export function parentPage(page: SettingsPage): SettingsPage | null {
  return PARENTS[page]
}

/**
 * How many taps from the root: 0 for the root, 1 for a group, 2 for a value
 * list. A screen that answers anything larger means the tree is too deep for
 * a settings menu.
 */
export function pageDepth(page: SettingsPage): number {
  let depth = 0
  let current: SettingsPage | null = page
  // The root is the point "from" is measured against, so it is not a step.
  while (current !== null && current !== 'root') {
    depth += 1
    current = PARENTS[current]
    if (depth > ALL_PAGES.length) return Number.POSITIVE_INFINITY // cycle guard
  }
  return depth
}

/** The group a leaf belongs to, or `null` for the root and the groups. */
export function groupOf(page: SettingsPage): SettingsGroup | null {
  const parent: SettingsPage | null = PARENTS[page]
  return parent === 'playback' || parent === 'subtitles' ? parent : null
}
