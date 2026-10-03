/**
 * Unit tests: watch history as resume-on-open depends on it
 * (src/stores/historyStore.ts).
 * Run: npm test
 *
 * The behaviour under guard is the *merge* in `recordWatch`: opening an
 * episode is what creates its entry, so opening it again must not erase the
 * position the viewer resumes from. It shipped with `progress: 0, position: 0`
 * on every open, which made "remember where I was" impossible no matter what
 * the player recorded.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * The store opens its zustand `persist` at *module* load against
 * `window.localStorage` — `window` is RN's alias for `globalThis`, which Node
 * has none of — so the fake below has to exist before that import, hence the
 * dynamic import. A plain map, no `use` prefix (see `playerPrefs.test.ts`).
 */
function installFreshStorage(): void {
  const store = new Map<string, string>()
  const global = globalThis as unknown as { window?: unknown }
  global.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    },
  }
}

installFreshStorage()

const { selectEpisodeProgress, useHistoryStore } = await import(
  '../src/stores/historyStore.ts'
)

/** Fresh ids per test — the store is a module-level singleton. */
let nextId = 910_000

function freshEpisode() {
  return { animeId: nextId++, episode: 1 }
}

test('opening an episode creates its entry without inventing a position', () => {
  const { animeId, episode } = freshEpisode()
  useHistoryStore.getState().recordWatch({ animeId, title: 'Test', episode })

  const entry = useHistoryStore
    .getState()
    .entries.find((e) => e.animeId === animeId && e.episode === episode)
  assert.ok(entry, 'the entry exists after the first open')
  assert.equal(entry.position, undefined)
  assert.equal(entry.progress, undefined)
  assert.deepEqual(selectEpisodeProgress(useHistoryStore.getState().entries, animeId, episode), {
    position: 0,
    percent: 0,
  })
})

test('the recorded position survives reopening the same episode', () => {
  const { animeId, episode } = freshEpisode()
  const store = useHistoryStore.getState()
  store.recordWatch({ animeId, title: 'Test', episode })
  store.updateProgress(animeId, episode, 42, 754)

  // What every reopen does: record the view again, saying nothing about
  // playback. Before the merge this zeroed the position.
  useHistoryStore.getState().recordWatch({ animeId, title: 'Test', episode })

  const entries = useHistoryStore.getState().entries
  const entry = entries.find((e) => e.animeId === animeId && e.episode === episode)
  assert.equal(entry?.position, 754)
  assert.equal(entry?.progress, 42)
  assert.deepEqual(selectEpisodeProgress(entries, animeId, episode), {
    position: 754,
    percent: 42,
  })
})

test('a deliberate reset still clears the position', () => {
  const { animeId, episode } = freshEpisode()
  const store = useHistoryStore.getState()
  store.recordWatch({ animeId, title: 'Test', episode })
  store.updateProgress(animeId, episode, 10, 60)
  store.recordWatch({ animeId, title: 'Test', episode, progress: 0, position: 0 })

  const entry = useHistoryStore
    .getState()
    .entries.find((e) => e.animeId === animeId && e.episode === episode)
  assert.equal(entry?.position, 0)
  assert.equal(entry?.progress, 0)
})

test('episodes are kept apart — each resumes from its own place', () => {
  const animeId = nextId++
  const store = useHistoryStore.getState()
  store.recordWatch({ animeId, title: 'Test', episode: 1 })
  store.updateProgress(animeId, 1, 30, 300)
  store.recordWatch({ animeId, title: 'Test', episode: 2 })
  store.updateProgress(animeId, 2, 80, 1200)

  const entries = useHistoryStore.getState().entries
  assert.deepEqual(selectEpisodeProgress(entries, animeId, 1), { position: 300, percent: 30 })
  assert.deepEqual(selectEpisodeProgress(entries, animeId, 2), { position: 1200, percent: 80 })
  // A never-played episode has nothing to resume.
  assert.deepEqual(selectEpisodeProgress(entries, animeId, 3), { position: 0, percent: 0 })
})

test('nonsense history resolves to zeros instead of throwing', () => {
  const animeId = nextId++
  const store = useHistoryStore.getState()
  store.recordWatch({
    animeId,
    title: 'Test',
    episode: 1,
    progress: Number.NaN,
    position: Number.NaN,
  })

  assert.deepEqual(selectEpisodeProgress(useHistoryStore.getState().entries, animeId, 1), {
    position: 0,
    percent: 0,
  })
})
