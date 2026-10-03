/**
 * Unit tests: subtitle conversion (src/extensions/subtitles/convert.ts).
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looksLikeSrt, srtToVtt } from '../src/extensions/subtitles/convert.ts'

test('converts a typical SRT document to WebVTT', () => {
  const srt = [
    '1',
    '00:00:01,000 --> 00:00:02,500',
    'Hello there',
    '',
    '2',
    '00:00:03,200 --> 00:00:04,000',
    'Second line',
    '',
  ].join('\r\n')

  const vtt = srtToVtt(srt)
  assert.ok(vtt)
  assert.ok(vtt.startsWith('WEBVTT\n'))
  assert.match(vtt, /00:00:01\.000 --> 00:00:02\.500\nHello there/)
  assert.match(vtt, /00:00:03\.200 --> 00:00:04\.000\nSecond line/)
  assert.ok(!vtt.includes(',000')) // comma timestamps converted
})

test('accepts blocks without a numeric counter line', () => {
  const srt = '00:00:01,000 --> 00:00:02,000\nJust text\n'
  const vtt = srtToVtt(srt)
  assert.ok(vtt)
  assert.match(vtt, /00:00:01\.000 --> 00:00:02\.000\nJust text/)
})

test('passes already-VTT documents through (trimmed, otherwise untouched)', () => {
  const vttDoc = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n'
  assert.equal(srtToVtt(vttDoc), vttDoc.trim())
})

test('strips ASS-ish inline tags some SRT files carry', () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n{\\an8}Top line\n'
  const out = srtToVtt(srt)
  assert.ok(out)
  assert.match(out, /00:00:01\.000 --> 00:00:02\.000\nTop line/)
  assert.ok(!out.includes('{\\an8}'))
})

test('skips malformed blocks but keeps valid ones', () => {
  const srt = [
    'garbage block without timing',
    '',
    '1',
    'not-a-time --> also-not',
    'ignored',
    '',
    '2',
    '00:00:05,000 --> 00:00:06,000',
    'Kept',
    '',
  ].join('\n')
  const out = srtToVtt(srt)
  assert.ok(out)
  assert.ok(out.includes('Kept'))
  assert.ok(!out.includes('ignored'))
})

test('returns null for empty or non-caption garbage', () => {
  assert.equal(srtToVtt(''), null)
  assert.equal(srtToVtt('   \n  '), null)
  assert.equal(srtToVtt('just some text with no cues'), null)
  assert.equal(srtToVtt('1\nno arrows here\ntext'), null)
})

test('tolerates a UTF-8 BOM', () => {
  const out = srtToVtt('\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')
  assert.ok(out)
  assert.ok(out.startsWith('WEBVTT'))
})

test('looksLikeSrt detects caption timing lines', () => {
  assert.equal(looksLikeSrt('1\n00:00:01,000 --> 00:00:02,000\nHi'), true)
  assert.equal(looksLikeSrt('00:00:01.000 --> 00:00:02.000'), true)
  assert.equal(looksLikeSrt('export default {}'), false)
})
