/**
 * Unit tests: the mobile-only i18n overlay (src/i18n/mobile.ts).
 * Run: npm test
 *
 * The synced `tests/i18n.test.ts` only knows the shared pixiWeb bundles, so
 * Android-only strings must be held to the same bar here: every language covers
 * the same key set, placeholders agree, and every `mobileKeys` constant points
 * at a key that actually exists (a typo would render a raw dot-path on screen).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mobileKeys, mobileOverlay } from '../src/i18n/mobile.ts'

type Leaves = Record<string, string>

function flatten(value: unknown, prefix = '', out: Leaves = {}): Leaves {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  } else if (typeof value === 'string' && prefix) {
    out[prefix] = value
  }
  return out
}

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\{\s*([a-zA-Z0-9_]+)(\s*,[^}]*)?\}\}/g)]
    .map((m) => m[1])
    .sort()
}

const en = flatten(mobileOverlay.en)
const tr = flatten(mobileOverlay.tr)
const ru = flatten(mobileOverlay.ru)

test('tr and ru cover exactly the en overlay key set', () => {
  const enKeys = Object.keys(en)
  for (const [lang, dict] of [
    ['tr', tr],
    ['ru', ru],
  ] as const) {
    const missing = enKeys.filter((key) => !(key in dict))
    const extra = Object.keys(dict).filter((key) => !(key in en))
    assert.deepEqual(missing, [], `${lang} is missing overlay keys: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `${lang} has unexpected overlay keys: ${extra.join(', ')}`)
  }
})

test('every mobileKeys constant resolves to an overlay key', () => {
  for (const [name, key] of Object.entries(mobileKeys)) {
    // Plural bases resolve through i18next's `_one` / `_other` buckets.
    const resolved = key in en || `${key}_one` in en || `${key}_other` in en
    assert.ok(resolved, `mobileKeys.${name} points at a missing key: ${key}`)
  }
})

test('interpolation placeholders match across en/tr/ru', () => {
  for (const [lang, dict] of [
    ['tr', tr],
    ['ru', ru],
  ] as const) {
    for (const [key, message] of Object.entries(en)) {
      assert.deepEqual(
        placeholders(dict[key] ?? ''),
        placeholders(message),
        `placeholder mismatch for overlay key ${key} (${lang})`,
      )
    }
  }
})
