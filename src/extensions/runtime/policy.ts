/**
 * Network + input policy enforced by the HOST before anything reaches
 * pixiClient (spec §25). Pure functions — unit tested directly.
 */
import { ExtensionError } from './errors.ts'

/** Hard limits applied to extension-driven requests. */
export const POLICY = {
  maxHeaders: 32,
  maxHeaderName: 64,
  maxHeaderValue: 4_096,
  maxUrlLength: 4_096,
  maxBodyChars: 1_000_000,
  /** Refused at download time (spec §19: don't execute arbitrary blobs). */
  maxExtensionBytes: 512_000,
  /** Cap on a single extension HTTP response body we buffer as text. */
  maxHttpResponseChars: 2_000_000,
} as const

/** Only http(s) targets — the bridge enforces the rest (docs pixiClient §6.5). */
export function assertHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > POLICY.maxUrlLength) {
    throw new ExtensionError('VALIDATION_FAILED', 'The extension provided an invalid URL.')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ExtensionError('VALIDATION_FAILED', 'The extension provided an invalid URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExtensionError('VALIDATION_FAILED', 'Only http(s) URLs are allowed.')
  }
  return url.toString()
}

/** Merge `query` params into a validated target URL. */
export function buildTargetUrl(raw: string, query?: Record<string, unknown> | null): string {
  const base = assertHttpUrl(raw)
  if (!query) return base
  const url = new URL(base)
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'object') continue
    url.searchParams.set(String(key), String(value))
  }
  const out = url.toString()
  if (out.length > POLICY.maxUrlLength) {
    throw new ExtensionError('VALIDATION_FAILED', 'The extension built an over-long URL.')
  }
  return out
}

const VALID_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/**
 * Sanitize extension-supplied upstream headers: valid RFC tokens only,
 * no CR/LF (header injection), bounded count/size. Returns null when the
 * result is empty (callers then use the transparent query form).
 */
export function sanitizeHeaders(raw: unknown): Record<string, string> | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, string> = {}
  let count = 0
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= POLICY.maxHeaders) break
    const key = String(name)
    if (!VALID_HEADER_NAME.test(key) || key.length > POLICY.maxHeaderName) continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    const str = String(value)
    // Strip control chars — nothing may forge a header line.
    const clean = str.replace(/[\r\n]/g, '').slice(0, POLICY.maxHeaderValue)
    if (clean.length !== str.replace(/[\r\n]/g, '').length) continue
    out[key] = clean
    count++
  }
  return count > 0 ? out : null
}

/** Normalize an extension body for the bridge's JSON form (text only). */
export function sanitizeBody(body: unknown): string | null {
  if (body === null || body === undefined) return null
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  if (typeof text !== 'string') return null
  if (text.length > POLICY.maxBodyChars) {
    throw new ExtensionError('VALIDATION_FAILED', 'The request body is too large.')
  }
  return text
}

/** HTML instead of a JS module → the URL points at a web page. */
export function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 512).trimStart().toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head') ||
    head.startsWith('<script') || head.startsWith('<?xml')
}
