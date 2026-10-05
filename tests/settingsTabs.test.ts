/**
 * Unit tests: the Settings category list (src/pages/Settings/tabs.ts).
 * Run: npm test
 *
 * The tab strip is pure data, which makes it worth pinning: a category dropped
 * from `SETTINGS_TABS` silently disappears from the page, and a label key that
 * no longer resolves renders as a raw dot-path on the chip.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mobileOverlay } from '../src/i18n/mobile.ts'
import { DEFAULT_TAB, SETTINGS_TABS, type SettingsTab } from '../src/pages/Settings/tabs.ts'

/** The `settings` namespace of the English overlay — the chips are `settings.*`. */
const en = mobileOverlay.en.settings as Record<string, string>

/** `settings.tabGeneral` → `tabGeneral`, the key the namespace is keyed by. */
function localName(labelKey: string): string {
  return labelKey.replace(/^settings\./, '')
}

test('the five categories are present, ordered and unique', () => {
  assert.deepEqual(
    SETTINGS_TABS.map((tab) => tab.key),
    ['general', 'appearance', 'playback', 'extensions', 'data'],
  )
  const keys = SETTINGS_TABS.map((tab) => tab.key)
  assert.equal(new Set(keys).size, keys.length, 'a category is listed twice')
})

test('the default tab is one of the categories', () => {
  const keys: SettingsTab[] = SETTINGS_TABS.map((tab) => tab.key)
  assert.ok(keys.includes(DEFAULT_TAB), `DEFAULT_TAB "${DEFAULT_TAB}" is not a category`)
})

test('every category label resolves in the overlay', () => {
  for (const tab of SETTINGS_TABS) {
    assert.ok(
      tab.labelKey.startsWith('settings.'),
      `category "${tab.key}" must live under settings.*, got ${tab.labelKey}`,
    )
    assert.ok(
      localName(tab.labelKey) in en,
      `category "${tab.key}" points at a missing key: ${tab.labelKey}`,
    )
  }
})

test('every category is labelled in all three languages', () => {
  for (const lang of ['en', 'tr', 'ru'] as const) {
    const namespace = mobileOverlay[lang].settings as Record<string, string>
    for (const tab of SETTINGS_TABS) {
      const label = namespace[localName(tab.labelKey)]
      assert.ok(label, `${lang} is missing the label for "${tab.key}"`)
    }
  }
})