/**
 * Unit tests: network + input policy (src/extensions/runtime/policy.ts).
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  POLICY,
  assertHttpUrl,
  buildTargetUrl,
  looksLikeHtml,
  sanitizeBody,
  sanitizeHeaders,
} from '../src/extensions/runtime/policy.ts'
import { ExtensionError } from '../src/extensions/runtime/errors.ts'

function throwsValidationError(fn: () => unknown, message?: string): void {
  assert.throws(
    fn,
    (err: unknown) => {
      assert.ok(err instanceof ExtensionError, `expected ExtensionError, got ${String(err)}`)
      assert.equal(err.code, 'VALIDATION_FAILED')
      if (message !== undefined) assert.equal(err.message, message)
      return true
    },
  )
}

// --- assertHttpUrl ---------------------------------------------------------

test('accepts http(s) URLs and normalizes them', () => {
  assert.equal(assertHttpUrl('https://a.test/x'), 'https://a.test/x')
  assert.equal(assertHttpUrl('http://a.test'), 'http://a.test/') // URL adds the slash
  assert.equal(assertHttpUrl('https://a.test/x?y=1#z'), 'https://a.test/x?y=1#z')
})

test('rejects non-http protocols with the protocol message', () => {
  throwsValidationError(() => assertHttpUrl('ftp://a.test/f'), 'Only http(s) URLs are allowed.')
  throwsValidationError(() => assertHttpUrl('javascript:alert(1)'), 'Only http(s) URLs are allowed.')
  throwsValidationError(() => assertHttpUrl('data:text/html,x'), 'Only http(s) URLs are allowed.')
  throwsValidationError(() => assertHttpUrl('file:///etc/passwd'), 'Only http(s) URLs are allowed.')
})

test('rejects relative, empty and non-string URLs', () => {
  const msg = 'The extension provided an invalid URL.'
  throwsValidationError(() => assertHttpUrl('/relative/path'), msg)
  throwsValidationError(() => assertHttpUrl('not a url'), msg)
  throwsValidationError(() => assertHttpUrl(''), msg)
  throwsValidationError(() => assertHttpUrl(undefined), msg)
  throwsValidationError(() => assertHttpUrl(123), msg)
  throwsValidationError(() => assertHttpUrl('https://a.test/' + 'x'.repeat(POLICY.maxUrlLength)), msg)
})

// --- buildTargetUrl --------------------------------------------------------

test('merges query params into the target URL', () => {
  const out = buildTargetUrl('https://a.test/api', { page: 2, q: 'cowboy bebop' })
  const url = new URL(out)
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('q'), 'cowboy bebop')
})

test('skips null/undefined/object values', () => {
  const url = new URL(buildTargetUrl('https://a.test/api', { a: null, b: undefined, c: { deep: 1 }, d: 'keep' }))
  assert.equal(url.searchParams.has('a'), false)
  assert.equal(url.searchParams.has('b'), false)
  assert.equal(url.searchParams.has('c'), false)
  assert.equal(url.searchParams.get('d'), 'keep')
})

test('appends to an existing query string', () => {
  const url = new URL(buildTargetUrl('https://a.test/api?x=1', { y: 2 }))
  assert.equal(url.searchParams.get('x'), '1')
  assert.equal(url.searchParams.get('y'), '2')
})

test('returns the base unchanged when there is no query', () => {
  assert.equal(buildTargetUrl('https://a.test/api'), 'https://a.test/api')
  assert.equal(buildTargetUrl('https://a.test/api', {}), 'https://a.test/api')
})

test('rejects query values that blow past the URL limit', () => {
  throwsValidationError(
    () => buildTargetUrl('https://a.test/api', { blob: 'x'.repeat(POLICY.maxUrlLength) }),
    'The extension built an over-long URL.',
  )
})

// --- sanitizeHeaders -------------------------------------------------------

test('keeps valid headers as-is', () => {
  assert.deepEqual(sanitizeHeaders({ Referer: 'https://a.test/', 'X-Token': 'abc' }), {
    Referer: 'https://a.test/',
    'X-Token': 'abc',
  })
})

test('drops invalid header names (spaces, colons, CRLF, too long)', () => {
  const out = sanitizeHeaders({
    'Bad Name': 'x',
    'X:Evil': 'x',
    'X\r\nInjected': 'x',
    ['K'.repeat(65)]: 'x',
    'X-Good': 'ok',
  })
  assert.deepEqual(out, { 'X-Good': 'ok' })
})

test('scrubs CR/LF from header values (no header-line forgery)', () => {
  const out = sanitizeHeaders({ 'X-Trace': 'a\r\nb\rc\nd' })
  assert.deepEqual(out, { 'X-Trace': 'abcd' })
})

test('drops oversized header values entirely', () => {
  const out = sanitizeHeaders({ 'X-Big': 'x'.repeat(POLICY.maxHeaderValue + 1) })
  assert.equal(out, null)
})

test('drops non-string values and returns null when nothing survives', () => {
  assert.equal(sanitizeHeaders({ 'X-Obj': { a: 1 }, 'X-Arr': [1] }), null)
  assert.equal(sanitizeHeaders(null), null)
  assert.equal(sanitizeHeaders(undefined), null)
  assert.equal(sanitizeHeaders('string'), null)
  assert.equal(sanitizeHeaders([]), null)
  assert.equal(sanitizeHeaders({}), null)
})

test('caps the number of forwarded headers at the policy limit', () => {
  const raw: Record<string, string> = {}
  for (let i = 0; i < POLICY.maxHeaders + 10; i++) raw[`X-H${i}`] = 'v'
  const out = sanitizeHeaders(raw)
  assert.ok(out)
  assert.equal(Object.keys(out).length, POLICY.maxHeaders)
})

// --- sanitizeBody ----------------------------------------------------------

test('passes strings through, serializes objects, maps nullish to null', () => {
  assert.equal(sanitizeBody('raw text'), 'raw text')
  assert.equal(sanitizeBody({ a: 1 }), '{"a":1}')
  assert.equal(sanitizeBody([1, 2]), '[1,2]')
  assert.equal(sanitizeBody(null), null)
  assert.equal(sanitizeBody(undefined), null)
})

test('rejects bodies above the size limit with friendly copy', () => {
  throwsValidationError(
    () => sanitizeBody('x'.repeat(POLICY.maxBodyChars + 1)),
    'The request body is too large.',
  )
})

// --- looksLikeHtml ---------------------------------------------------------

test('detects HTML instead of a JS module', () => {
  assert.equal(looksLikeHtml('<!DOCTYPE html><html></html>'), true)
  assert.equal(looksLikeHtml('   <html lang="en">'), true)
  assert.equal(looksLikeHtml('<?xml version="1.0"?><rss>'), true)
  assert.equal(looksLikeHtml('<script>alert(1)</script>'), true)
  assert.equal(looksLikeHtml('\uFEFF<!doctype html>'), true) // BOM tolerated
  assert.equal(looksLikeHtml('export default {}'), false)
  assert.equal(looksLikeHtml('const x = 1'), false)
  assert.equal(looksLikeHtml('{"json":"also fine"}'), false)
})
