/**
 * Connection-status precedence tests (mobile-owned).
 *
 * The status surface drives the "Running / Stopped / Connecting / Error"
 * indicator, so the ordering rules are pinned here rather than discovered on
 * device.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { deriveConnectionStatus, type ConnectionSignals } from '../src/lib/connectionStatus.ts'

const base: ConnectionSignals = {
  isOnline: true,
  isFetching: false,
  isError: false,
  hasData: false,
}

test('offline wins over everything → stopped', () => {
  assert.equal(
    deriveConnectionStatus({ ...base, isOnline: false, isFetching: true, isError: true, hasData: true }),
    'stopped',
  )
})

test('a failed request → error (even while online and retrying)', () => {
  assert.equal(deriveConnectionStatus({ ...base, isError: true }), 'error')
  assert.equal(deriveConnectionStatus({ ...base, isError: true, isFetching: true }), 'error')
})

test('first load in flight → connecting', () => {
  assert.equal(deriveConnectionStatus({ ...base, isFetching: true }), 'connecting')
})

test('background refetch over loaded data stays running', () => {
  assert.equal(deriveConnectionStatus({ ...base, isFetching: true, hasData: true }), 'running')
})

test('idle and healthy → running', () => {
  assert.equal(deriveConnectionStatus({ ...base, hasData: true }), 'running')
  assert.equal(deriveConnectionStatus(base), 'running')
})
