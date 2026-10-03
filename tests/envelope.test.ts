/**
 * Unit tests: sandbox envelope parsing (src/platform/quickjs/types.ts).
 *
 * Every native result — boot, call, timeout, engine crash — arrives as a JSON
 * string and is funnelled through `parseEnvelope`. A corrupt payload must
 * degrade to a well-formed error, never throw into the caller: the caller is
 * an `await` in the extension pool, and a throw there would surface as an
 * unhandled rejection instead of a friendly extension error.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseEnvelope } from '../src/platform/quickjs/types.ts'

test('a boot envelope keeps manifest and methods', () => {
  const envelope = parseEnvelope(
    JSON.stringify({
      ok: true,
      manifest: { id: 'demo' },
      methods: { getSources: true, getSubtitles: false },
    }),
  )
  assert.equal(envelope.ok, true)
  if (!envelope.ok) throw new Error('unreachable')
  assert.deepEqual(envelope.manifest, { id: 'demo' })
  assert.deepEqual(envelope.methods, { getSources: true, getSubtitles: false })
})

test('a call envelope keeps its value', () => {
  const envelope = parseEnvelope(JSON.stringify({ ok: true, value: [{ url: 'https://a/b.mp4' }] }))
  assert.equal(envelope.ok, true)
  if (!envelope.ok) throw new Error('unreachable')
  assert.deepEqual(envelope.value, [{ url: 'https://a/b.mp4' }])
})

test('a success envelope may legitimately carry no value', () => {
  const envelope = parseEnvelope(JSON.stringify({ ok: true }))
  assert.equal(envelope.ok, true)
})

test('an error envelope preserves the code and message', () => {
  const envelope = parseEnvelope(
    JSON.stringify({ ok: false, err: { code: 'EXTENSION_TIMEOUT', message: 'too slow' } }),
  )
  assert.equal(envelope.ok, false)
  if (envelope.ok) throw new Error('unreachable')
  assert.equal(envelope.err.code, 'EXTENSION_TIMEOUT')
  assert.equal(envelope.err.message, 'too slow')
})

test('an error envelope without a message still produces one', () => {
  const envelope = parseEnvelope(JSON.stringify({ ok: false, err: { code: 'EXTENSION_ERROR' } }))
  assert.equal(envelope.ok, false)
  if (envelope.ok) throw new Error('unreachable')
  assert.equal(envelope.err.message, 'The extension failed.')
})

test('a non-string payload degrades to an error envelope', () => {
  for (const input of [undefined, null, 42, {}, []] as unknown[]) {
    const envelope = parseEnvelope(input)
    assert.equal(envelope.ok, false)
    if (envelope.ok) throw new Error('unreachable')
    assert.equal(envelope.err.code, 'EXTENSION_ERROR')
    assert.ok(envelope.err.message.length > 0)
  }
})

test('malformed JSON degrades to an error envelope', () => {
  const envelope = parseEnvelope('{"ok": true,')
  assert.equal(envelope.ok, false)
  if (envelope.ok) throw new Error('unreachable')
  assert.equal(envelope.err.code, 'EXTENSION_ERROR')
})

test('JSON that is not an object degrades to an error envelope', () => {
  for (const input of ['"text"', '17', 'null', 'true']) {
    const envelope = parseEnvelope(input)
    assert.equal(envelope.ok, false)
  }
})

test('a truthy "ok" that is not boolean true is not treated as success', () => {
  const envelope = parseEnvelope(JSON.stringify({ ok: 'yes', value: 1 }))
  assert.equal(envelope.ok, false)
})

test('an error envelope whose code is not a string degrades safely', () => {
  const envelope = parseEnvelope(JSON.stringify({ ok: false, err: { code: 7 } }))
  assert.equal(envelope.ok, false)
  if (envelope.ok) throw new Error('unreachable')
  assert.equal(envelope.err.code, 'EXTENSION_ERROR')
})
