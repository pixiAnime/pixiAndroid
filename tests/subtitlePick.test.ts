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