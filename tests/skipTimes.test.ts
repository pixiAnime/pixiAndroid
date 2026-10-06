/**
 * Unit tests: Aniskip skip times (src/api/aniskip/parse.ts and
 * src/pages/Watch/player/skipTimes.ts).
 * Run: npm test
 *
 * Both modules are pure on purpose, and both encode decisions that are easy to
 * get subtly wrong: what to do with a payload that is missing, backwards or
 * of a kind the player cannot act on, and exactly when an interval counts as
 * current. The parser also has to survive a community endpoint that answers
 * with whatever its contributors submitted.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseSkipTimes, skipTimesUrl, type SkipInterval } from '../src/api/aniskip/parse.ts'
import {
  activeSkipInterval,
  episodeLengthSeconds,
  SKIP_LEAD_IN_SECONDS,
} from '../src/pages/Watch/player/skipTimes.ts'

/** The shape the live `GET /v1/skip-times/{malId}/{episode}` endpoint answers with. */
function payload(results: unknown[], found = true): unknown {
  return { statusCode: 200, found, results }
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    interval: { start_time: 65, end_time: 155 },
    skip_type: 'op',
    skip_id: 'bf98fb07-c8f8-4399-baa4-1579f03b7e90',
    episode_length: 1500.04,
    ...overrides,
  }
}

function interval(overrides: Partial<SkipInterval> = {}): SkipInterval {
  return { id: '1', kind: 'op', startTime: 65, endTime: 155, ...overrides }
}

/* ------------------------------- parsing ------------------------------- */

test('parses an opening and an ending', () => {
  const parsed = parseSkipTimes(
    payload([
      entry(),
      entry({
        skip_type: 'ed',
        skip_id: 'b60b5bf4-7fc9-40e9-b178-71d2a4f0e6c9',
        interval: { start_time: 1200, end_time: 1290 },
      }),
    ]),
  )
  assert.equal(parsed.length, 2)
  assert.deepEqual(
    parsed.map((i) => [i.kind, i.startTime, i.endTime]),
    [
      ['op', 65, 155],
      ['ed', 1200, 1290],
    ],
  )
  assert.equal(parsed[0].id, 'bf98fb07-c8f8-4399-baa4-1579f03b7e90')
})

test('found: false is an empty answer, not a failure', () => {
  assert.deepEqual(parseSkipTimes(payload([], false)), [])
})

test('unusable payloads come back empty', () => {
  for (const raw of [null, undefined, 'nope', 42, {}, { found: true }, { results: 'no' }]) {
    assert.deepEqual(parseSkipTimes(raw), [], `expected [] for ${JSON.stringify(raw)}`)
  }
})

test('drops entries that cannot be acted on', () => {
  const parsed = parseSkipTimes(
    payload([
      'not an object',
      entry({ interval: { start_time: '65', end_time: 155 } }), // non-numeric
      entry({ interval: { start_time: 155, end_time: 65 } }), // backwards
      entry({ interval: { start_time: 90, end_time: 90 } }), // empty
      entry({ interval: { start_time: -5, end_time: 60 } }), // negative
      entry({ skip_type: 'recap' }), // a kind the player has no button for
      entry({ skip_type: 'mixed-op' }),
      entry(), // the one good entry, kept
    ]),
  )
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].startTime, 65)
})

test('falls back to a synthetic id when skip_id is missing', () => {
  const parsed = parseSkipTimes(payload([entry({ skip_id: undefined })]))
  assert.equal(parsed[0].id, 'op:65')
})

/* -------------------------------- request ------------------------------- */

test('the URL carries the episode segment — without it the endpoint 404s', () => {
  const url = skipTimesUrl({ malId: 21, episode: 7 })
  assert.equal(url.pathname, '/v1/skip-times/21/7')
  assert.equal(url.searchParams.getAll('types').join(','), 'op,ed')
  assert.equal(url.searchParams.get('episodeLength'), null)
})

test('a known episode length rides along, an unknown one is omitted', () => {
  const known = skipTimesUrl({ malId: 21, episode: 1, episodeLength: 1440.4 })
  assert.equal(known.searchParams.get('episodeLength'), '1440')
  for (const bad of [undefined, 0, -1]) {
    const url = skipTimesUrl({ malId: 21, episode: 1, episodeLength: bad })
    assert.equal(url.searchParams.get('episodeLength'), null, `for ${String(bad)}`)
  }
})

test('only the kinds the viewer allows are requested', () => {
  const url = skipTimesUrl({ malId: 21, episode: 1, types: ['ed'] })
  assert.deepEqual(url.searchParams.getAll('types'), ['ed'])
})

/* --------------------------- episode length --------------------------- */

test('reads the episode length out of Jikan prose', () => {
  assert.equal(episodeLengthSeconds('24 min per ep'), 1440)
  assert.equal(episodeLengthSeconds('24 min'), 1440)
})

test('an unusable episode length is omitted, not zero', () => {
  for (const raw of [undefined, '', 'unknown', 'per ep']) {
    assert.equal(episodeLengthSeconds(raw), undefined, `for ${String(raw)}`)
  }
  assert.equal(episodeLengthSeconds('0 min per ep'), undefined)
})

/* -------------------------- interval selection ------------------------- */

test('offers the interval from just before it starts through its end', () => {
  const op = interval()
  assert.equal(activeSkipInterval([op], op.startTime - SKIP_LEAD_IN_SECONDS), op)
  assert.equal(activeSkipInterval([op], op.startTime + 10), op)
  // Landing exactly on the end is still inside it — that frame is the first
  // frame after the opening, which is what the button promises.
  assert.equal(activeSkipInterval([op], op.endTime), op)
})

test('is silent outside an interval', () => {
  const op = interval()
  assert.equal(activeSkipInterval([op], 0), null)
  assert.equal(activeSkipInterval([op], op.startTime - SKIP_LEAD_IN_SECONDS - 0.5), null)
  assert.equal(activeSkipInterval([op], op.endTime + 0.5), null)
})

test('a resume past the opening does not offer to skip it', () => {
  // The viewer dropped in at 20:00 of a 24-minute episode; the ending is still
  // ahead of them and is offered, the opening is not.
  const ed = interval({ id: '2', kind: 'ed', startTime: 1200, endTime: 1290 })
  const parsed = [interval(), ed]
  assert.equal(activeSkipInterval(parsed, 1250), ed)
  assert.equal(activeSkipInterval(parsed, 1250)?.kind, 'ed')
})

test('no intervals, no button', () => {
  assert.equal(activeSkipInterval([], 100), null)
  assert.equal(activeSkipInterval(undefined, 100), null)
})

test('the interval starting soonest wins when two are live', () => {
  const op = interval({ id: 'op', startTime: 65, endTime: 155 })
  const ed = interval({ id: 'ed', startTime: 120, endTime: 210 })
  assert.equal(activeSkipInterval([op, ed], 130)?.id, 'ed')
})