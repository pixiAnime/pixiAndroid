/**
 * Unit tests: content display preferences (src/lib/contentPreferences.ts).
 * Run: npm test
 *
 * The pickers are pure; the storage reads are exercised against a fake
 * `localStorage`, the same pattern as the playerPrefs tests.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isAdultContent,
  filterAdult,
  pickStoredTitle,
  pickTitle,
  readHideAdult,
  readTitleLanguage,
  writeHideAdult,
  writeTitleLanguage,
} from '../src/lib/contentPreferences.ts'

type Store = Map<string, string>

function installStore(): Store {
  const store: Store = new Map()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
    getAllKeys: () => [...store.keys()],
  }
  return store
}

const anime = {
  title: 'Boku no Hero Academia',
  title_english: 'My Hero Academia',
  title_japanese: '僕のヒーローアカデミア',
}

test('pickTitle follows the chosen language and falls back through the rest', () => {
  assert.equal(pickTitle(anime, 'en'), 'My Hero Academia')
  assert.equal(pickTitle(anime, 'romaji'), 'Boku no Hero Academia')
  assert.equal(pickTitle(anime, 'native'), '僕のヒーローアカデミア')

  // Missing the preferred field falls back rather than returning empty.
  assert.equal(pickTitle({ title: 'Romaji Only' }, 'en'), 'Romaji Only')
  assert.equal(pickTitle({ title_english: 'English Only' }, 'native'), 'English Only')
})

test('pickStoredTitle follows the chosen language with its two fields', () => {
  const entry = { title: 'Kimetsu no Yaiba', titleEnglish: 'Demon Slayer' }
  assert.equal(pickStoredTitle(entry, 'en'), 'Demon Slayer')
  assert.equal(pickStoredTitle(entry, 'romaji'), 'Kimetsu no Yaiba')
  assert.equal(pickStoredTitle(entry, 'native'), 'Kimetsu no Yaiba')
  assert.equal(pickStoredTitle({ title: 'Only Romaji' }, 'en'), 'Only Romaji')
})

test('isAdultContent detects the hentai rating and genre', () => {
  assert.equal(isAdultContent({ rating: 'Rx - Hentai' }), true)
  assert.equal(isAdultContent({ genres: [{ name: 'Hentai' }] }), true)
  assert.equal(isAdultContent({ rating: 'PG-13 - Teens 13 or older', genres: [{ name: 'Action' }] }), false)
  assert.equal(isAdultContent({}), false)
})

test('filterAdult drops adult items only when hiding is on', () => {
  const items = [
    { rating: 'PG-13', genres: [{ name: 'Action' }] },
    { rating: 'Rx - Hentai' },
    { genres: [{ name: 'Hentai' }] },
  ]
  assert.equal(filterAdult(items, true).length, 1)
  assert.equal(filterAdult(items, false).length, 3)
})

test('title language defaults to en and round-trips through storage', () => {
  installStore()
  assert.equal(readTitleLanguage(), 'en')
  writeTitleLanguage('romaji')
  assert.equal(readTitleLanguage(), 'romaji')
  // A value written by a future build falls back to the default.
  ;(globalThis as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage.setItem(
    'pixiandroid.content.titleLanguage',
    'klingon',
  )
  assert.equal(readTitleLanguage(), 'en')
})

test('hide-adult defaults to off and round-trips through storage', () => {
  installStore()
  assert.equal(readHideAdult(), false)
  writeHideAdult(true)
  assert.equal(readHideAdult(), true)
})
