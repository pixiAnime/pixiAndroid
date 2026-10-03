/**
 * Unit tests: a connection that never answers must not own the app's clock
 * (src/api/deadline.ts).
 * Run: npm test
 *
 * The rule guards the complaint "on first launch the status sat on
 * Connecting…" — a blackholed Jikan connection used to spend OkHttp's ~12s
 * window twice *before* the AniList fallback was even asked, so the first
 * paint waited ~30s. The deadline is what turns that into a hand-over.
 *
 * Timers are mocked (`t.mock.timers`), so nothing here sleeps for real.
 */
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'

import { fetchWithDeadline } from '../src/api/deadline.ts'
import { ApiError } from '../src/api/errors.ts'

const REAL_FETCH = globalThis.fetch

type Fetch = typeof globalThis.fetch

/** A fetch that only settles when its signal aborts — a blackholed host. */
const hangingFetch: Fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      reject(error)
    })
  })

function withFetch(t: TestContext, impl: Fetch): void {
  ;(globalThis as { fetch: Fetch }).fetch = impl
  t.after(() => {
    ;(globalThis as { fetch: Fetch }).fetch = REAL_FETCH
  })
}

/** Settles a rejection into a value so the assertion can inspect it. */
function settle(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

test('a connection that never answers is cut at the deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  withFetch(t, hangingFetch)

  const pending = settle(
    fetchWithDeadline('https://api.jikan.moe/v4/seasons/now', undefined, { timeoutMs: 6_000 }),
  )
  t.mock.timers.tick(6_000)

  const error = await pending
  assert.ok(error instanceof ApiError, 'the ladder must see an ApiError, not an AbortError')
  assert.equal(error.kind, 'network')
  assert.match(error.message, /timed out after 6000ms/)
})

test('the request is still live just before the deadline, dead just after', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  withFetch(t, hangingFetch)

  let settled = false
  const pending = fetchWithDeadline('https://api.jikan.moe/v4/seasons/now', undefined, {
    timeoutMs: 6_000,
  }).then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )

  t.mock.timers.tick(5_999)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(settled, false, '5.999s must still be a live request')

  t.mock.timers.tick(1)
  await pending
  assert.equal(settled, true, 'the deadline itself cuts it — no OkHttp window to wait out')
})

test('the caller cancelling reads as aborted, not as a service failure', async (t) => {
  withFetch(t, hangingFetch)
  const caller = new AbortController()

  const pending = settle(
    fetchWithDeadline('https://api.jikan.moe/v4/seasons/now', undefined, {
      signal: caller.signal,
      timeoutMs: 6_000,
    }),
  )
  caller.abort()

  const error = await pending
  assert.ok(error instanceof ApiError)
  // `aborted` is what withFallback refuses to count and what never retries.
  assert.equal(error.kind, 'aborted')
})

test('a signal already aborted short-circuits before any request', async (t) => {
  let called = false
  withFetch(t, () => {
    called = true
    return Promise.reject(new Error('should not run'))
  })

  await assert.rejects(
    () =>
      fetchWithDeadline('https://api.jikan.moe/v4/seasons/now', undefined, {
        signal: AbortSignal.abort(),
      }),
    (error: unknown) => error instanceof ApiError && error.kind === 'aborted',
  )
  assert.equal(called, false)
})

test('a response passes straight through', async (t) => {
  withFetch(t, () => Promise.resolve(new Response('{"ok":true}', { status: 200 })))

  const response = await fetchWithDeadline('https://api.jikan.moe/v4/seasons/now')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
})

test('a plain fetch error leaves unchanged, so the client ladder still owns it', async (t) => {
  const boom = new TypeError('Network request failed')
  withFetch(t, () => Promise.reject(boom))

  await assert.rejects(
    () => fetchWithDeadline('https://api.jikan.moe/v4/seasons/now'),
    (error: unknown) => error === boom,
  )
})
