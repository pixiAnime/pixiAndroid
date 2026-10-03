/**
 * Unit tests: the persist write gate (src/lib/persistSignature.ts).
 * Run: npm test
 *
 * The rule guards the cost behind every debounced cache write — a full
 * `dehydrate` + `JSON.stringify` of up to 1.5MB plus an equally large MMKV
 * rewrite — against events that change nothing the payload carries. If two
 * signatures compare equal the writer must be safe to skip, so each test here
 * pins one way they are allowed to differ.
 *
 * Filtering (success-only, PERSISTED_QUERY_ROOTS) lives in queryClient and is
 * deliberately NOT re-tested: this module takes the already-filtered entries.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { persistSignature, type PersistEntry } from '../src/lib/persistSignature.ts'

function entry(overrides: Partial<PersistEntry> = {}): PersistEntry {
  return {
    queryHash: '["jikan","seasonNow"]',
    status: 'success',
    dataUpdatedAt: 1_700_000_000_000,
    dataUpdateCount: 1,
    ...overrides,
  }
}

test('an untouched cache keeps its signature — the write is skipped', () => {
  const cache = [entry(), entry({ queryHash: '["jikan","top"]' })]
  assert.equal(persistSignature(cache), persistSignature(cache))
})

test('the never-persisted baseline is stable too', () => {
  assert.equal(persistSignature([]), persistSignature([]))
  assert.equal(persistSignature([]), '0')
})

test('a successful refetch changes it', () => {
  const before = persistSignature([entry()])
  const after = persistSignature([entry({ dataUpdatedAt: 1_700_000_060_000 })])
  assert.notEqual(before, after)
})

test('a refetch of identical data still changes it', () => {
  // dataUpdateCount moves even when dataUpdatedAt is rounded back by the
  // server — the payload carries dataUpdateCount, so the gate must too.
  assert.notEqual(
    persistSignature([entry({ dataUpdateCount: 1 })]),
    persistSignature([entry({ dataUpdateCount: 2 })]),
  )
})

test('leaving a persistable state changes it', () => {
  assert.notEqual(
    persistSignature([entry({ status: 'success' })]),
    persistSignature([entry({ status: 'error' })]),
  )
})

test('a query entering or leaving the cache changes it', () => {
  const one = persistSignature([entry()])
  const two = persistSignature([entry(), entry({ queryHash: '["jikan","search"]' })])
  assert.notEqual(one, two)
  assert.notEqual(two, persistSignature([entry({ queryHash: '["jikan","search"]' })]))
})

test('order follows the payload array, so a reshuffle differs', () => {
  const a = entry({ queryHash: '["jikan","a"]' })
  const b = entry({ queryHash: '["jikan","b"]' })
  assert.notEqual(persistSignature([a, b]), persistSignature([b, a]))
})

test('hashes with separators cannot be confused with one another', () => {
  // The join is deliberately positional: two different caches must never
  // collapse into one signature (a skip where a write was needed).
  const x = persistSignature([entry({ queryHash: '["jikan","a"]' })])
  const y = persistSignature([entry({ queryHash: '["jikan","a"]' }), entry({ queryHash: '' })])
  assert.notEqual(x, y)
  assert.match(x, /^\d+\|/)
})
