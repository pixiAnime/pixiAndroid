/**
 * Unit tests: repository manifest validation
 * (src/extensions/repo/RepoLoader.ts).
 * Run: npm test
 *
 * The repository schema is the mobile-only layer on top of the extension
 * system, so its validation is pinned here next to the shared validator tests.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateRepoManifest } from '../src/extensions/repo/RepoLoader.ts'
import { ExtensionError } from '../src/extensions/runtime/errors.ts'

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Pixi Providers',
    version: '1',
    providers: [
      {
        id: 'demo-ext',
        name: 'Demo',
        author: 'Tester',
        version: '1.0.0',
        apiVersion: '1',
        url: 'https://example.com/demo.js',
      },
    ],
    ...overrides,
  }
}

function throwsWith(raw: unknown, message?: string): void {
  assert.throws(
    () => validateRepoManifest(raw),
    (err: unknown) => {
      assert.ok(err instanceof ExtensionError, `expected ExtensionError, got ${String(err)}`)
      assert.equal(err.code, 'VALIDATION_FAILED')
      if (message !== undefined) assert.equal(err.message, message)
      return true
    },
  )
}

test('accepts a valid manifest and normalizes the fields', () => {
  const manifest = validateRepoManifest(base())
  assert.equal(manifest.name, 'Pixi Providers')
  assert.equal(manifest.version, '1')
  assert.equal(manifest.providers.length, 1)
  assert.equal(manifest.providers[0].id, 'demo-ext')
  assert.equal(manifest.providers[0].url, 'https://example.com/demo.js')
  assert.equal(manifest.providers[0].author, 'Tester')
})

test('derives a provider id from the module URL when omitted', () => {
  const manifest = validateRepoManifest({
    name: 'Repo',
    providers: [{ name: 'Demo', url: 'https://cdn.example.com/path/my-provider.js' }],
  })
  assert.equal(manifest.providers[0].id, 'my-provider')
  // Author falls back to the repo author, then to a placeholder.
  assert.equal(manifest.providers[0].author, 'Unknown')
})

test('falls back to the repo author for providers that omit one', () => {
  const manifest = validateRepoManifest({
    name: 'Repo',
    author: 'Studio',
    providers: [{ name: 'Demo', url: 'https://example.com/demo.js' }],
  })
  assert.equal(manifest.providers[0].author, 'Studio')
})

test('rejects a manifest missing a name', () => {
  throwsWith(base({ name: undefined }), 'The repository manifest is missing a valid "name".')
})

test('rejects an empty provider list', () => {
  throwsWith(base({ providers: [] }), 'The repository manifest lists no providers.')
})

test('rejects a non-object provider entry', () => {
  throwsWith(base({ providers: ['nope'] }), 'The repository manifest has a provider that is not an object.')
})

test('rejects a non-http provider URL', () => {
  throwsWith(
    base({ providers: [{ name: 'Demo', url: 'ftp://example.com/demo.js' }] }),
    'The repository manifest "providers[].url" must be a valid http(s) URL.',
  )
})

test('rejects an invalid declared provider id', () => {
  throwsWith(
    base({ providers: [{ id: 'Bad Id!', name: 'Demo', url: 'https://example.com/demo.js' }] }),
    'The repository manifest "providers[].id" must be lowercase letters, digits, dots, dashes or underscores.',
  )
})

test('rejects a malformed provider version', () => {
  throwsWith(
    base({
      providers: [{ name: 'Demo', version: 'v1', url: 'https://example.com/demo.js' }],
    }),
    'The repository manifest "providers[].version" must look like 1.0.0.',
  )
})

test('rejects an unsupported api version', () => {
  throwsWith(
    base({
      providers: [{ name: 'Demo', apiVersion: '99', url: 'https://example.com/demo.js' }],
    }),
    'The repository lists a provider that requires a newer extension API.',
  )
})

test('rejects an invalid icon URL', () => {
  throwsWith(
    base({
      providers: [{ name: 'Demo', icon: 'not-a-url', url: 'https://example.com/demo.js' }],
    }),
    'The repository manifest "providers[].icon" must be a valid http(s) URL.',
  )
})

test('rejects a manifest with too many providers', () => {
  const providers = Array.from({ length: 201 }, (_, i) => ({
    name: `P${i}`,
    url: `https://example.com/p${i}.js`,
  }))
  throwsWith(base({ providers }), 'The repository manifest lists too many providers.')
})
