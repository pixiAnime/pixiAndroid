/**
 * Unit tests: player preferences that have a *default* — right now the volume
 * (src/pages/Watch/playerPrefs.ts).
 * Run: npm test
 *
 * These guard a shipped bug rather than a hypothetical one: `Number(null)` is
 * `0`, so reading a key that does not exist yet used to mean "no sound at all",
 * on every install, until the viewer found the slider.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readVolume, writeVolume } from '../src/pages/Watch/playerPrefs.ts'

type Store = Map<string, string>

/**
 * `localStorage` does not exist in Node (and must not be relied upon if it
 * does), so each test installs its own empty store. `playerPrefs` reads the
 * global lazily, so installing after import is correct.
 *
 * Named without a `use` prefix on purpose — this is a plain test helper, and
 * `react-hooks/rules-of-hooks` would otherwise claim a `use`-prefixed function
 * is called from a loop.
 */
function installFreshStorage(): Store {
  const store = new Map<string, string>()
  const global = globalThis as unknown as { localStorage?: unknown }
  global.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
  return store
}

test('a store with no volume key reads as full volume, not silence', () => {
  installFreshStorage()
  assert.equal(readVolume(), 1)
})

test('an empty value is a missing value, not zero', () => {
  const store = installFreshStorage()
  store.set('pixiandroid.player.volume', '')
  assert.equal(readVolume(), 1)
})

test('a deliberately silenced player stays silent', () => {
  // 0 is a real answer here (unlike, say, a skip distance) — it just may never
  // be the *absent* one.
  const store = installFreshStorage()
  store.set('pixiandroid.player.volume', '0')
  assert.equal(readVolume(), 0)
})

test('a stored level round-trips', () => {
  const store = installFreshStorage()
  store.set('pixiandroid.player.volume', '0.4')
  assert.equal(readVolume(), 0.4)

  writeVolume(0.75)
  assert.equal(store.get('pixiandroid.player.volume'), '0.75')
  assert.equal(readVolume(), 0.75)
})

test('a value written by a future version falls back to the default', () => {
  for (const bad of ['1.5', '-0.2', 'loud', 'null', 'NaN', 'Infinity']) {
    const store = installFreshStorage()
    store.set('pixiandroid.player.volume', bad)
    assert.equal(readVolume(), 1, `expected 1 for "${bad}"`)
  }
})