/**
 * Unit tests: manifest validation (src/extensions/runtime/validator.ts).
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManifest } from '../src/extensions/runtime/validator.ts'
import { ExtensionError } from '../src/extensions/runtime/errors.ts'

const methods = { getSources: true, getSubtitles: false }

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-ext',
    name: 'Demo',
    author: 'Tester',
    version: '1.0.0',
    apiVersion: '1',
    capabilities: { streaming: true, subtitles: false },
    ...overrides,
  }
}

function throwsWith(raw: unknown, probe: typeof methods, code: string, message?: string): void {
  assert.throws(
    () => validateManifest(raw, probe),
    (err: unknown) => {
      assert.ok(err instanceof ExtensionError, `expected ExtensionError, got ${String(err)}`)
      assert.equal(err.code, code)
      if (message !== undefined) assert.equal(err.message, message)
      return true
    },
  )
}

test('accepts a valid manifest and normalizes its fields', () => {
  const { manifest, capabilities } = validateManifest(
    base({ name: '  Demo  ', description: 'short blurb' }),
    methods,
  )
  assert.equal(manifest.id, 'demo-ext')
  assert.equal(manifest.name, 'Demo') // trimmed
  assert.equal(manifest.author, 'Tester')
  assert.equal(manifest.version, '1.0.0')
  assert.equal(manifest.apiVersion, '1')
  assert.equal(manifest.description, 'short blurb')
  assert.deepEqual(capabilities, { streaming: true, subtitles: false })
  assert.deepEqual(manifest.capabilities, capabilities)
})

test('rejects a missing or non-object manifest', () => {
  throwsWith(undefined, methods, 'VALIDATION_FAILED', 'The extension does not export a valid manifest.')
  throwsWith('nope', methods, 'VALIDATION_FAILED', 'The extension does not export a valid manifest.')
  throwsWith([1, 2], methods, 'VALIDATION_FAILED', 'The extension does not export a valid manifest.')
})

test('rejects invalid ids (charset and length)', () => {
  const idMsg = 'The manifest "id" must be lowercase letters, digits, dots, dashes or underscores.'
  throwsWith(base({ id: 'Bad ID!' }), methods, 'VALIDATION_FAILED', idMsg)
  throwsWith(base({ id: 'UPPER' }), methods, 'VALIDATION_FAILED', idMsg)
  throwsWith(base({ id: 'a' }), methods, 'VALIDATION_FAILED', idMsg) // too short
  throwsWith(base({ id: '' }), methods, 'VALIDATION_FAILED', 'The manifest is missing a valid "id".')
  throwsWith(base({ id: 42 }), methods, 'VALIDATION_FAILED', 'The manifest is missing a valid "id".')
})

test('accepts well-formed ids', () => {
  for (const id of ['demo-ext', 'demo.ext2', 'a1', 'ext_one-2']) {
    const { manifest } = validateManifest(base({ id }), methods)
    assert.equal(manifest.id, id)
  }
})

test('requires name, author and a semantic-looking version', () => {
  throwsWith(base({ name: '   ' }), methods, 'VALIDATION_FAILED', 'The manifest is missing a valid "name".')
  throwsWith(base({ author: undefined }), methods, 'VALIDATION_FAILED', 'The manifest is missing a valid "author".')
  throwsWith(base({ version: '1.0' }), methods, 'VALIDATION_FAILED', 'The manifest "version" must look like 1.0.0.')
  throwsWith(base({ version: 'v1.0.0' }), methods, 'VALIDATION_FAILED', 'The manifest "version" must look like 1.0.0.')
})

test('missing apiVersion defaults to "1"', () => {
  const overrides = base()
  delete overrides.apiVersion
  const { manifest } = validateManifest(overrides, methods)
  assert.equal(manifest.apiVersion, '1')
})

test('unsupported apiVersion uses the exact friendly copy', () => {
  throwsWith(
    base({ apiVersion: '2' }),
    methods,
    'API_VERSION_UNSUPPORTED',
    'This extension requires a newer extension API.',
  )
})

test('declared capabilities must match implemented methods', () => {
  throwsWith(
    base({ capabilities: { streaming: true, subtitles: true } }),
    methods, // getSubtitles missing
    'VALIDATION_FAILED',
    'The manifest capabilities do not match the implemented methods.',
  )
  throwsWith(
    base({ capabilities: { streaming: false, subtitles: false } }),
    methods,
    'VALIDATION_FAILED',
    'The manifest capabilities do not match the implemented methods.',
  )
})

test('legacy type: field derives capabilities (and must match methods)', () => {
  const both = { getSources: true, getSubtitles: true }
  const noCaps = base()
  delete noCaps.capabilities

  const { capabilities } = validateManifest({ ...noCaps, type: 'both' }, both)
  assert.deepEqual(capabilities, { streaming: true, subtitles: true })

  throwsWith(
    { ...noCaps, type: 'both' },
    methods, // subtitles method missing
    'VALIDATION_FAILED',
    'The manifest type does not match the implemented methods.',
  )
})

test('with no capabilities/type, capabilities derive from implemented methods', () => {
  const noCaps = base()
  delete noCaps.capabilities

  const { capabilities } = validateManifest(noCaps, methods)
  assert.deepEqual(capabilities, { streaming: true, subtitles: false })

  throwsWith(
    noCaps,
    { getSources: false, getSubtitles: false },
    'VALIDATION_FAILED',
    'The extension implements neither getSources() nor getSubtitles().',
  )
})

test('icon must be a valid http(s) URL', () => {
  const iconMsg = 'The manifest "icon" must be a valid http(s) URL.'
  throwsWith(base({ icon: 'ftp://a.test/i.svg' }), methods, 'VALIDATION_FAILED', iconMsg)
  throwsWith(base({ icon: 'not a url' }), methods, 'VALIDATION_FAILED', iconMsg)
  const { manifest } = validateManifest(base({ icon: 'https://a.test/i.svg' }), methods)
  assert.equal(manifest.icon, 'https://a.test/i.svg')
})

test('over-long fields are rejected with a helpful message', () => {
  throwsWith(
    base({ description: 'x'.repeat(1001) }),
    methods,
    'VALIDATION_FAILED',
    'The manifest "description" is too long (max 1000 characters).',
  )
})
