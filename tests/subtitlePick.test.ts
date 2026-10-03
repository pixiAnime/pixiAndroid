/**
 * Unit tests: which subtitle track an episode opens on
 * (src/pages/Watch/subtitlePick.ts).
 * Run: npm test
 *
 * The decision that used to be made inline — "whatever the provider flagged" —
 * put Turkish captions under a Türkçe app exactly as often as not. The rules
 * are pure, so they belong here rather than being discovered on device.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  nextSubtitleSelection,
  pickInitialSubtitle,
  sameLanguage,
} from '../src/pages/Watch/subtitlePick.ts'

/** Provider-ordered tracks: language sort puts English first, `default` last. */
const tracks = [
  { key: 'p|english', language: 'en' },
  { key: 'p|turkish', language: 'tur' },
  { key: 'p|russian', language: 'rus' },
  { key: 'p|japanese', language: 'jpn', default: true },
]

test("the app's own language wins over the provider's default", () => {
  assert.equal(pickInitialSubtitle(tracks, 'tr'), 'p|turkish')
  assert.equal(pickInitialSubtitle(tracks, 'en'), 'p|english')
  assert.equal(pickInitialSubtitle(tracks, 'ru'), 'p|russian')
})

test('ISO 639-2/3 spellings match the two-letter app language', () => {
  // The table is the point: an extension that says `tur` and an app that says
  // `tr` are describing the same track.
  assert.equal(sameLanguage('tr', 'tur'), true)
  assert.equal(sameLanguage('en', 'eng'), true)
  assert.equal(sameLanguage('ru', 'rus'), true)
  assert.equal(sameLanguage('tr', 'eng'), false)
})

test('matching is on the base language and ignores case', () => {
  assert.equal(pickInitialSubtitle(tracks, 'TR'), 'p|turkish')
  assert.equal(sameLanguage('pt-BR', 'pt'), true)
  assert.equal(sameLanguage('pt_BR', 'PT'), true)
  assert.equal(sameLanguage('en-US', 'en-GB'), true)
})

test('the provider default is only consulted when the app language is absent', () => {
  // No Portuguese track: fall back to whatever the provider flagged.
  assert.equal(pickInitialSubtitle(tracks, 'pt'), 'p|japanese')
  // An unknown tag falls through the same way.
  assert.equal(pickInitialSubtitle(tracks, 'zz'), 'p|japanese')
})

test('no preference and no provider default leaves subtitles off', () => {
  // "Off" is a deliberate state, not a guess — nothing is invented here.
  assert.equal(pickInitialSubtitle([{ key: 'p|english', language: 'en' }], null), null)
  assert.equal(pickInitialSubtitle([{ key: 'p|english', language: 'en' }], ''), null)
  assert.equal(pickInitialSubtitle([], 'tr'), null)
  assert.equal(pickInitialSubtitle([{ key: 'p|jpn', language: 'jpn' }], 'tr'), null)
})

test('the first matching track in provider order is the one that wins', () => {
  const twoTurkish = [
    { key: 'p|one', language: 'tr' },
    { key: 'p|two', language: 'tr' },
  ]
  assert.equal(pickInitialSubtitle(twoTurkish, 'tr'), 'p|one')
})

/* -------------------------------------------------------------------- *
 * What the page wraps around the pick — see `nextSubtitleSelection`.
 * -------------------------------------------------------------------- */

test('ASS is never chosen automatically, because it never renders here', () => {
  // `resolveSubtitleTrack` refuses the format and the settings menu filters it
  // out, so an automatic pick that lands on it reads as "nothing was selected".
  const mixed = [
    { key: 'p|tr-ass', language: 'tr', format: 'ass' },
    { key: 'p|en-vtt', language: 'en', format: 'vtt', default: true },
  ]
  assert.equal(pickInitialSubtitle(mixed, 'tr'), 'p|en-vtt')
  assert.equal(pickInitialSubtitle([mixed[0]], 'tr'), null)
})

test('a stopgap default gives way when the app language arrives', () => {
  // The subtitle query re-runs once the AniList id resolves, so the first list
  // is often a provider's English default and the Turkish archive answers
  // later. Locking on the first hit is exactly the reported bug.
  const englishOnly = [{ key: 'p|en', language: 'en', default: true }]
  const withTurkish = [...englishOnly, { key: 'a|tr', language: 'tr' }]

  const first = nextSubtitleSelection({
    current: null,
    manual: false,
    subtitles: englishOnly,
    language: 'tr',
  })
  assert.equal(first, 'p|en')

  const later = nextSubtitleSelection({
    current: first,
    manual: false,
    subtitles: withTurkish,
    language: 'tr',
  })
  assert.equal(later, 'a|tr')
})

test('a manual choice — captions off included — is final', () => {
  const subtitles = [{ key: 'a|tr', language: 'tr' }]
  assert.equal(
    nextSubtitleSelection({ current: null, manual: true, subtitles, language: 'tr' }),
    null,
  )
  assert.equal(
    nextSubtitleSelection({ current: 'p|en', manual: true, subtitles, language: 'tr' }),
    'p|en',
  )
})

test('an empty list keeps what is on screen rather than blinking captions off', () => {
  // While a query re-runs the list is briefly empty; that is not a decision.
  assert.equal(
    nextSubtitleSelection({ current: 'p|en', manual: false, subtitles: [], language: 'tr' }),
    'p|en',
  )
  assert.equal(
    nextSubtitleSelection({ current: null, manual: false, subtitles: [], language: 'tr' }),
    null,
  )
})