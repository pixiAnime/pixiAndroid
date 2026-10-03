/**
 * Unit tests: dotted-version compare (src/extensions/runtime/version.ts).
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions } from '../src/extensions/runtime/version.ts'

test('equal versions compare to 0', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0)
  assert.equal(compareVersions('0.0.0', '0.0.0'), 0)
})

test('newer version on either side orders correctly', () => {
  assert.ok(compareVersions('1.1.0', '1.0.0') > 0)
  assert.ok(compareVersions('1.0.0', '1.1.0') < 0)
  assert.ok(compareVersions('2.0.0', '1.9.9') > 0)
  assert.ok(compareVersions('1.0.1', '0.9.9') > 0)
})

test('multi-digit segments compare numerically, not lexically', () => {
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0) // "10" > "9", not "10" < "9"
  assert.ok(compareVersions('1.0.9', '1.0.10') < 0)
})

test('missing segments pad as zero', () => {
  assert.equal(compareVersions('1.0', '1.0.0'), 0)
  assert.equal(compareVersions('1', '1.0.0'), 0)
  assert.ok(compareVersions('1.1', '1.0.9') > 0)
})

test('non-numeric segments count as 0 (never throws)', () => {
  assert.equal(compareVersions('1.0.x', '1.0.0'), 0)
  assert.ok(compareVersions('1.0.1', '1.0.x') > 0)
})
