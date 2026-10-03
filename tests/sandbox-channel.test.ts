/**
 * Sandbox channel ids must come from whatever entropy the page offers:
 * `crypto.randomUUID` is secure-context-only, and a site opened over plain
 * http (LAN IP / tunnel) must still boot its sandbox — the unguarded call
 * used to fail every install with
 * "The extension could not be loaded in this browser."
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomChannel } from '../src/extensions/runtime/channel.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const HEX32_RE = /^[0-9a-f]{32}$/

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

function withCrypto(value: unknown, run: () => void): void {
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true })
  try {
    run()
  } finally {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto)
    else Reflect.deleteProperty(globalThis, 'crypto')
  }
}

test('uses randomUUID when the environment provides it', () => {
  assert.match(randomChannel(), UUID_RE)
})

test('missing randomUUID falls back to CSPRNG bytes (insecure origins)', () => {
  withCrypto(
    {
      getRandomValues(view: Uint8Array) {
        view.fill(7)
        return view
      },
    },
    () => {
      const channel = randomChannel()
      assert.match(channel, HEX32_RE)
      assert.equal(channel, '07'.repeat(16), 'bytes must be hex-encoded in order')
    },
  )
})

test('no crypto at all still yields a unique id', () => {
  withCrypto(undefined, () => {
    const first = randomChannel()
    const second = randomChannel()
    assert.match(first, HEX32_RE)
    assert.notEqual(first, second, 'Math.random fallback must not repeat ids')
  })
})
