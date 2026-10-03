/**
 * Unit tests: result normalization + deterministic sorting/deduping
 * (src/extensions/providers/normalize.ts).
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  embeddedSubtitles,
  inferStreamType,
  inferSubtitleFormat,
  mergeSubtitles,
  normalizeSources,
  normalizeSubtitles,
  qualityRank,
  sortSources,
} from '../src/extensions/providers/normalize.ts'
import { ExtensionError } from '../src/extensions/runtime/errors.ts'
import type { FlatSource, FlatSubtitle } from '../src/extensions/providers/normalize.ts'

const provider = { id: 'demo', name: 'Demo' }

function src(url: string, opts: Partial<FlatSource> = {}): FlatSource {
  return {
    url,
    type: 'unknown',
    providerId: 'a',
    providerName: 'A',
    key: `a|${url}`,
    ...opts,
  }
}

function sub(url: string, language: string, opts: Partial<FlatSubtitle> = {}): FlatSubtitle {
  return {
    url,
    language,
    format: 'vtt',
    providerId: 'a',
    providerName: 'A',
    key: `a|${url}`,
    ...opts,
  }
}

// --- normalizeSources ------------------------------------------------------

test('drops invalid entries and counts them', () => {
  const { items, invalid } = normalizeSources(
    [
      { url: 'https://a.test/ok.mp4' },
      { url: 'notaurl' },
      { url: 'ftp://a.test/x.mp4' },
      null,
      'a string',
      { noUrl: true },
    ],
    provider,
  )
  assert.equal(items.length, 1)
  assert.equal(invalid, 5)
  assert.equal(items[0].url, 'https://a.test/ok.mp4')
})

test('dedupes repeated URLs inside one provider without counting them invalid', () => {
  const { items, invalid } = normalizeSources(
    [
      { url: 'https://a.test/one.mp4' },
      { url: 'https://a.test/one.mp4' },
      { url: 'https://a.test/two.mp4' },
    ],
    provider,
  )
  assert.equal(items.length, 2)
  assert.equal(invalid, 0)
})

test('non-array results throw INVALID_RESULT with the provider id', () => {
  assert.throws(
    () => normalizeSources({ sources: [] }, provider),
    (err: unknown) =>
      err instanceof ExtensionError &&
      err.code === 'INVALID_RESULT' &&
      err.extensionId === 'demo' &&
      err.message === 'The extension did not return a list of sources.',
  )
})

test('infers stream type from mime type, then URL extension', () => {
  const { items } = normalizeSources(
    [
      { url: 'https://a.test/x', mimeType: 'application/vnd.apple.mpegurl' },
      { url: 'https://a.test/list.m3u8?token=1' },
      { url: 'https://a.test/clip.webm' },
      { url: 'https://a.test/clip.m4v' },
      { url: 'https://a.test/mystery.bin' },
    ],
    provider,
  )
  assert.deepEqual(
    items.map((i) => i.type),
    ['hls', 'hls', 'webm', 'mp4', 'unknown'],
  )
})

test('an explicit valid type wins over inference', () => {
  const { items } = normalizeSources(
    [{ url: 'https://a.test/list.m3u8', type: 'mp4' }],
    provider,
  )
  assert.equal(items[0].type, 'mp4')
})

test('headers are sanitized: bad names dropped, CRLF scrubbed', () => {
  const { items } = normalizeSources(
    [
      {
        url: 'https://a.test/x.mp4',
        headers: { Referer: 'https://a.test/', 'Bad Name': 'x', 'X-Evil': 'a\r\nInjected: 1' },
      },
    ],
    provider,
  )
  assert.deepEqual(items[0].headers, {
    Referer: 'https://a.test/',
    'X-Evil': 'aInjected: 1',
  })
})

test('flat results carry provider identity and a stable key', () => {
  const { items } = normalizeSources([{ url: 'https://a.test/x.mp4' }], provider)
  assert.equal(items[0].providerId, 'demo')
  assert.equal(items[0].providerName, 'Demo')
  assert.equal(items[0].key, 'demo|https://a.test/x.mp4')
})

// --- normalizeSubtitles ----------------------------------------------------

test('drops subtitle entries with invalid languages or URLs', () => {
  const { items, invalid } = normalizeSubtitles(
    [
      { url: 'https://a.test/en.vtt', language: 'en' },
      { url: 'https://a.test/bad-lang.vtt', language: 'en_US' },
      { url: 'https://a.test/no-lang.vtt' },
      { url: 'notaurl', language: 'fr' },
      { url: 'https://a.test/ok2.vtt', language: 'pt-br' }, // valid regional tag
    ],
    provider,
  )
  assert.deepEqual(
    items.map((i) => i.language),
    ['en', 'pt-br'],
  )
  assert.equal(invalid, 3)
})

test('infers subtitle format from explicit field, then extension', () => {
  const { items } = normalizeSubtitles(
    [
      { url: 'https://a.test/a.vtt', language: 'en' },
      { url: 'https://a.test/b.bin', language: 'en', format: 'srt' },
      { url: 'https://a.test/c.ass?x=1', language: 'en' },
      { url: 'https://a.test/d.ssa', language: 'en' },
      { url: 'https://a.test/e.bin', language: 'en' },
    ],
    provider,
  )
  assert.deepEqual(
    items.map((i) => i.format),
    ['vtt', 'srt', 'ass', 'ass', 'unknown'],
  )
})

test('non-array subtitle results throw INVALID_RESULT', () => {
  assert.throws(
    () => normalizeSubtitles('nope', provider),
    (err: unknown) => err instanceof ExtensionError && err.code === 'INVALID_RESULT',
  )
})

test('subtitle headers are sanitised exactly like source headers', () => {
  const { items } = normalizeSubtitles(
    [
      {
        url: 'https://a.test/en.vtt',
        language: 'en',
        headers: { 'Client-Protocol-Model': 'RCSA-14402/05', 'Bad Name': 'x', 'X-Evil': 'a\r\nInjected: 1' },
      },
      { url: 'https://a.test/fr.vtt', language: 'fr', headers: {} },
    ],
    provider,
  )
  assert.deepEqual(items[0].headers, {
    'Client-Protocol-Model': 'RCSA-14402/05',
    'X-Evil': 'aInjected: 1',
  })
  // Empty / unusable header maps collapse to `undefined` so the fetcher can
  // keep using the transparent query form.
  assert.equal(items[1].headers, undefined)
})

// --- sorting ---------------------------------------------------------------

test('qualityRank parses leading digits, else -1', () => {
  assert.equal(qualityRank('1080p'), 1080)
  assert.equal(qualityRank('720'), 720)
  assert.equal(qualityRank('4K'), -1)
  assert.equal(qualityRank('source'), -1)
  assert.equal(qualityRank(undefined), -1)
})

test('sortSources orders quality desc → type → provider → url, deterministically', () => {
  const hls720 = src('https://a.test/hls.m3u8', {
    type: 'hls',
    quality: '720p',
    providerId: 'a',
    providerName: 'Alpha',
  })
  const mp4720 = src('https://a.test/med.mp4', {
    type: 'mp4',
    quality: '720p',
    providerId: 'b',
    providerName: 'Beta',
  })
  const mp41080 = src('https://a.test/hd.mp4', {
    type: 'mp4',
    quality: '1080p',
    providerId: 'b',
    providerName: 'Beta',
  })
  const unknown = src('https://a.test/z.bin', { providerId: 'c', providerName: 'Cee' })

  const input = [hls720, mp4720, mp41080, unknown]
  const sorted = sortSources(input)
  assert.deepEqual(
    sorted.map((s) => s.url),
    [mp41080.url, hls720.url, mp4720.url, unknown.url],
  )
  // input not mutated
  assert.deepEqual(input, [hls720, mp4720, mp41080, unknown])
  // stable across repeated calls
  assert.deepEqual(sortSources(sorted), sorted)
})

// --- merging ---------------------------------------------------------------

test('mergeSubtitles dedupes by URL across providers (first wins) and sorts by language', () => {
  const groupA = [
    sub('https://a.test/en.vtt', 'en', { providerId: 'a', providerName: 'A' }),
    sub('https://shared.test/dup.vtt', 'de', { providerId: 'a', providerName: 'A' }),
  ]
  const groupB = [
    sub('https://b.test/fr.srt', 'fr', { providerId: 'b', providerName: 'B', format: 'srt' }),
    sub('https://shared.test/dup.vtt', 'de', { providerId: 'b', providerName: 'B' }),
    sub('https://b.test/es.vtt', 'es', { providerId: 'b', providerName: 'B' }),
  ]
  const merged = mergeSubtitles([groupA, groupB])
  assert.deepEqual(
    merged.map((m) => `${m.language}:${m.url}`),
    ['de:https://shared.test/dup.vtt', 'en:https://a.test/en.vtt', 'es:https://b.test/es.vtt', 'fr:https://b.test/fr.srt'],
  )
  assert.equal(merged.length, 4) // dup URL collapsed, first provider kept
})

test('embeddedSubtitles re-normalizes the selected source tracks under its provider', () => {
  const { items } = normalizeSources(
    [
      {
        url: 'https://a.test/x.mp4',
        subtitles: [
          { url: 'https://a.test/embedded.vtt', language: 'en', label: 'Embedded' },
          { url: 'also-bad', language: 'en' }, // dropped inside the source too
        ],
      },
    ],
    provider,
  )
  const embedded = embeddedSubtitles(items[0])
  assert.equal(embedded.length, 1)
  assert.equal(embedded[0].providerId, 'demo')
  assert.equal(embedded[0].label, 'Embedded')
  assert.deepEqual(embeddedSubtitles(null), [])
  assert.deepEqual(embeddedSubtitles(undefined), [])
})

// --- pure inference helpers ------------------------------------------------

test('inferStreamType and inferSubtitleFormat edge cases', () => {
  assert.equal(inferStreamType('video/mp4', 'https://a.test/x'), 'mp4')
  assert.equal(inferStreamType('application/x-mpegURL', 'https://a.test/x'), 'hls')
  assert.equal(inferStreamType(undefined, 'https://a.test/VIDEO.MP4?sig=1'), 'mp4')
  assert.equal(inferSubtitleFormat(undefined, 'https://a.test/s.vtt'), 'vtt')
  assert.equal(inferSubtitleFormat('ass', 'https://a.test/s.bin'), 'ass')
  assert.equal(inferSubtitleFormat('weird', 'https://a.test/s.bin'), 'unknown')
})
