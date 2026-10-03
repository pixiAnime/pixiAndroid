/**
 * Unit tests: how captions are bucketed per provider for both pickers
 * (src/pages/Watch/subtitleGroups.ts).
 * Run: npm test
 *
 * The rule under guard is identity, not aesthetics: a provider that streams
 * *and* subtitles has to land in the same bucket the source groups use, or
 * its inline caption row in the source card would silently never appear.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FlatSubtitle } from '../src/extensions/providers/normalize.ts'
import {
  groupSubtitlesByProvider,
  indexSubtitlesByProvider,
} from '../src/pages/Watch/subtitleGroups.ts'

/** Minimal valid track — `providerId`/`providerName` are what grouping reads. */
function track(providerId: string, url: string, language = 'tr'): FlatSubtitle {
  return {
    url: `https://cdn.example/${url}.vtt`,
    language,
    label: language.toUpperCase(),
    format: 'vtt',
    providerId,
    providerName: providerId === 'ayruki-auto' ? 'Ayruki Auto' : 'Altyazı Arşivi',
    key: `${providerId}|https://cdn.example/${url}.vtt`,
  }
}

test('tracks bucket by provider, in the order providers first appear', () => {
  const groups = groupSubtitlesByProvider([
    track('altyazi-arsivi', 'a-tr'),
    track('ayruki-auto', 'b-tr'),
    track('altyazi-arsivi', 'a-en', 'en'),
    track('ayruki-auto', 'b-en', 'en'),
  ])

  assert.deepEqual(
    groups.map((group) => group.providerId),
    ['altyazi-arsivi', 'ayruki-auto'],
  )
  assert.deepEqual(
    groups.map((group) => group.items.map((item) => item.key)),
    [
      ['altyazi-arsivi|https://cdn.example/a-tr.vtt', 'altyazi-arsivi|https://cdn.example/a-en.vtt'],
      ['ayruki-auto|https://cdn.example/b-tr.vtt', 'ayruki-auto|https://cdn.example/b-en.vtt'],
    ],
  )
  assert.equal(groups[0].providerName, 'Altyazı Arşivi')
})

test('an empty list groups to nothing instead of a phantom group', () => {
  assert.deepEqual(groupSubtitlesByProvider([]), [])
  assert.equal(indexSubtitlesByProvider([]).size, 0)
})

test('the source picker looks up captions by the same provider id', () => {
  const byProvider = indexSubtitlesByProvider([
    track('ayruki-auto', 'b-tr'),
    track('altyazi-arsivi', 'a-tr'),
  ])

  // `openani` streams but does not subtitle: no row, not an empty one.
  assert.equal(byProvider.has('openani'), false)
  assert.equal(byProvider.get('ayruki-auto')?.length, 1)
  assert.equal(byProvider.get('altyazi-arsivi')?.length, 1)
})

test('grouping does not mutate or reorder the input', () => {
  const input = [track('b', 'one'), track('a', 'two'), track('b', 'three')]
  const keysBefore = input.map((item) => item.key)

  const groups = groupSubtitlesByProvider(input)
  groups[0].items.pop()

  assert.deepEqual(
    input.map((item) => item.key),
    keysBefore,
  )
})
