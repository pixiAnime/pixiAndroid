/**
 * The categories the Settings hub is split into.
 *
 * Everything the page offers fits one of these five; a panel belongs to
 * whichever one the user would look under first. The keys are kept here rather
 * than in the tab bar so the tab bar stays a pure view and the mapping can be
 * asserted in a test.
 */
// Relative *and* explicit: this module is pure data and is asserted from
// `tests/settingsTabs.test.ts`, which node runs without the `@/` alias.
// Same style as `src/extensions/providers/*`, the other src modules imported
// by node under their test.
import { mobileKeys } from '../../i18n/mobile.ts'

export type SettingsTab = 'general' | 'appearance' | 'playback' | 'extensions' | 'data'

export interface TabDefinition {
  key: SettingsTab
  labelKey: string
}

/** Order is the order they are shown in — everyday settings first. */
export const SETTINGS_TABS: readonly TabDefinition[] = [
  { key: 'general', labelKey: mobileKeys.tabGeneral },
  { key: 'appearance', labelKey: mobileKeys.tabAppearance },
  { key: 'playback', labelKey: mobileKeys.tabPlayback },
  { key: 'extensions', labelKey: mobileKeys.tabExtensions },
  { key: 'data', labelKey: mobileKeys.tabData },
] as const

/** The tab the page opens on. */
export const DEFAULT_TAB: SettingsTab = 'general'