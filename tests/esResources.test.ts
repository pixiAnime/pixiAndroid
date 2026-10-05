/**
 * Unit tests: the Spanish resource bundle (src/i18n/resources/es.ts).
 * Run: npm test
 *
 * `es.ts` is typed `typeof en`, so TypeScript already catches a missing key
 * at build time — but `tests/` is deliberately outside the typecheck, and the
 * app must not silently fall back to English for a screen the user picked
 * Spanish for. These tests hold it to the same bar as tr/ru: the same key set,
 * the same plural buckets, the same interpolation placeholders.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import i18next from 'i18next'

import { en } from '../src/i18n/resources/en.ts'
import { es } from '../src/i18n/resources/es.ts'
import { mobileOverlay } from '../src/i18n/mobile.ts'

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

const enL = flatten(en)
const esL = flatten(es)

test('es covers exactly the en key set', () => {
  const missing = Object.keys(enL).filter((key) => !(key in esL))
  const extra = Object.keys(esL).filter((key) => !(key in enL))
  assert.deepEqual(missing, [], `es is missing keys: ${missing.join(', ')}`)
  assert.deepEqual(extra, [], `es has unexpected keys: ${extra.join(', ')}`)
})

test('every plural base has both Spanish buckets', () => {
  const bases = Object.keys(enL)
    .filter((key) => key.endsWith('_one'))
    .map((key) => key.slice(0, -'_one'.length))
  assert.ok(bases.length > 0, 'en has no plural keys — the check would be vacuous')
  for (const base of bases) {
    assert.ok(`${base}_one` in esL, `es is missing ${base}_one`)
    assert.ok(`${base}_other` in esL, `es is missing ${base}_other`)
  }
})

test('interpolation placeholders match en', () => {
  for (const key of Object.keys(enL)) {
    assert.deepEqual(
      placeholders(esL[key] ?? ''),
      placeholders(enL[key]),
      `placeholder mismatch for ${key}`,
    )
  }
})

test('no Spanish string is left in English', () => {
  // Spot-check the load-bearing namespaces rather than every string: identical
  // values are legitimate for proper nouns (Jikan, MyAnimeList, ASS…).
  const identifiers = ['settings.pageDesc', 'common.nothingHere', 'watch.noSourcesTitle']
  for (const key of identifiers) {
    assert.notEqual(esL[key], enL[key], `${key} still carries the English string`)
  }
})

/**
 * Same merge `src/i18n/index.ts` performs at boot, reproduced here because
 * that module pulls in React Native. This is the check that matters at the
 * end: a Spanish speaker tapping through the app gets Spanish, including the
 * strings that only exist in the mobile overlay and the plural forms.
 */
function withMobileOverlay(base: object, extra: object): object {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key]
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? { ...(current as object), ...(value as object) }
        : value
  }
  return out
}

test('the composed Spanish bundle resolves through i18next', async () => {
  const instance = i18next.createInstance()
  await instance.init({
    lng: 'es',
    fallbackLng: 'en',
    returnNull: false,
    interpolation: { escapeValue: false },
    resources: {
      es: { translation: withMobileOverlay(es, mobileOverlay.es) as never },
    },
  })

  const t = instance.t.bind(instance)
  assert.equal(t('nav.settings'), 'Ajustes')
  assert.equal(t('settings.tabGeneral'), 'General')
  assert.equal(t('settings.manageRepos'), 'Gestionar repositorios y proveedores')
  // A shared key and a plural base, to prove the merge did not shadow either.
  assert.equal(t('common.watchNow'), 'Ver ahora')
  assert.equal(t('hero.episodes', { count: 1 }), '1 episodio')
  assert.equal(t('hero.episodes', { count: 3 }), '3 episodios')
})