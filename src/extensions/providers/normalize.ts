/**
 * Result normalization — turns whatever an extension returned into the
 * strict, flat shapes the player and selectors consume (spec §17/§29).
 * Pure functions with no I/O: unit tested directly.
 *
 * Invalid entries are dropped and counted (never crash the aggregate);
 * sorting is deterministic metadata only — quality, format, provider name.
 */
import type { StreamSource, StreamType, SubtitleSource } from '../sdk/types.ts'
import { ExtensionError } from '../runtime/errors.ts'
import { assertHttpUrl, sanitizeHeaders } from '../runtime/policy.ts'

export interface ProviderMeta {
  id: string
  name: string
}

export interface FlatSource extends StreamSource {
  providerId: string
  providerName: string
  /** Stable identity for selection keys: provider + URL. */
  key: string
}

export interface FlatSubtitle extends SubtitleSource {
  providerId: string
  providerName: string
  key: string
}

export interface NormalizeResult<T> {
  items: T[]
  invalid: number
}

const STREAM_TYPES = new Set<StreamType>(['hls', 'mp4', 'webm', 'unknown'])
const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max) return undefined
  return trimmed
}

export function inferStreamType(mimeType: string | undefined, url: string): StreamType {
  const mime = (mimeType ?? '').toLowerCase()
  if (mime.includes('mpegurl') || mime.includes('m3u8')) return 'hls'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4') || mime.includes('mpeg') || mime.includes('quicktime')) return 'mp4'
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.m3u8')) return 'hls'
  if (path.endsWith('.webm')) return 'webm'
  if (path.endsWith('.mp4') || path.endsWith('.m4v')) return 'mp4'
  return 'unknown'
}

export function inferSubtitleFormat(format: unknown, url: string): SubtitleSource['format'] {
  if (format === 'vtt' || format === 'srt' || format === 'ass') return format
  const path = url.split('?')[0].toLowerCase()
  if (path.endsWith('.vtt')) return 'vtt'
  if (path.endsWith('.srt')) return 'srt'
  if (path.endsWith('.ass') || path.endsWith('.ssa')) return 'ass'
  return 'unknown'
}

function normalizeSubtitle(
  raw: unknown,
  provider: ProviderMeta,
): FlatSubtitle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as Partial<SubtitleSource>
  const language = text(candidate.language, 24)
  if (!language || !LANG_RE.test(language)) return null
  let url: string
  try {
    url = assertHttpUrl(candidate.url)
  } catch {
    return null
  }
  return {
    url,
    language,
    label: text(candidate.label, 80),
    format: inferSubtitleFormat(candidate.format, url),
    default: candidate.default === true,
    headers: sanitizeHeaders(candidate.headers) ?? undefined,
    providerId: provider.id,
    providerName: provider.name,
    key: `${provider.id}|${url}`,
  }
}

function normalizeSourceSubtitleList(
  raw: unknown,
  provider: ProviderMeta,
): SubtitleSource[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const items = raw
    .map((entry) => normalizeSubtitle(entry, provider))
    .filter((entry): entry is FlatSubtitle => entry !== null)
  return items.length > 0 ? items : undefined
}

/** Normalize a getSources() result. Non-array results throw INVALID_RESULT. */
export function normalizeSources(raw: unknown, provider: ProviderMeta): NormalizeResult<FlatSource> {
  if (!Array.isArray(raw)) {
    throw new ExtensionError('INVALID_RESULT', 'The extension did not return a list of sources.', provider.id)
  }
  const items: FlatSource[] = []
  const seen = new Set<string>()
  let invalid = 0

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      invalid++
      continue
    }
    const candidate = entry as Partial<StreamSource>
    let url: string
    try {
      url = assertHttpUrl(candidate.url)
    } catch {
      invalid++
      continue
    }
    if (seen.has(url)) continue
    seen.add(url)

    const mimeType = text(candidate.mimeType, 120)
    const type: StreamType =
      typeof candidate.type === 'string' && STREAM_TYPES.has(candidate.type as StreamType)
        ? (candidate.type as StreamType)
        : inferStreamType(mimeType, url)

    const headers = sanitizeHeaders(candidate.headers) ?? undefined
    const subtitles = normalizeSourceSubtitleList(candidate.subtitles, provider)

    items.push({
      url,
      type,
      mimeType,
      quality: text(candidate.quality, 24),
      language: languageOf(candidate.language),
      bitrate: numberOr(candidate.bitrate, 0, 1e12),
      size: numberOr(candidate.size, 0, Number.MAX_SAFE_INTEGER),
      isDefault: candidate.isDefault === true,
      headers,
      subtitles,
      providerId: provider.id,
      providerName: provider.name,
      key: `${provider.id}|${url}`,
    })
  }
  return { items, invalid }
}

/** Normalize a getSubtitles() result. Non-array results throw INVALID_RESULT. */
export function normalizeSubtitles(raw: unknown, provider: ProviderMeta): NormalizeResult<FlatSubtitle> {
  if (!Array.isArray(raw)) {
    throw new ExtensionError('INVALID_RESULT', 'The extension did not return a list of subtitles.', provider.id)
  }
  const items: FlatSubtitle[] = []
  const seen = new Set<string>()
  let invalid = 0
  for (const entry of raw) {
    const sub = normalizeSubtitle(entry, provider)
    if (!sub) {
      invalid++
      continue
    }
    if (seen.has(sub.key)) continue
    seen.add(sub.key)
    items.push(sub)
  }
  return { items, invalid }
}

function languageOf(value: unknown): string | undefined {
  const lang = text(value, 24)
  return lang && LANG_RE.test(lang) ? lang : undefined
}

function numberOr(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return undefined
  return value
}

/** Deterministic quality rank: leading digits of "1080p" → 1080, else -1. */
export function qualityRank(quality: string | undefined): number {
  if (!quality) return -1
  const match = /^(\d{3,4})/.exec(quality.trim())
  return match ? Number.parseInt(match[1], 10) : -1
}

/** Quality desc → format → provider → URL. No subjective ranking (§29). */
export function sortSources(items: FlatSource[]): FlatSource[] {
  return [...items].sort((a, b) => {
    const q = qualityRank(b.quality) - qualityRank(a.quality)
    if (q !== 0) return q
    const t = a.type.localeCompare(b.type)
    if (t !== 0) return t
    const p = a.providerName.localeCompare(b.providerName)
    if (p !== 0) return p
    const pa = a.providerId.localeCompare(b.providerId)
    if (pa !== 0) return pa
    return a.url.localeCompare(b.url)
  })
}

/** Dedupe by URL (first provider wins) → language/label/provider sort (§16). */
export function mergeSubtitles(groups: FlatSubtitle[][]): FlatSubtitle[] {
  const seen = new Set<string>()
  const merged: FlatSubtitle[] = []
  for (const group of groups) {
    for (const sub of group) {
      if (seen.has(sub.url)) continue
      seen.add(sub.url)
      merged.push(sub)
    }
  }
  return merged.sort((a, b) => {
    const lang = a.language.localeCompare(b.language)
    if (lang !== 0) return lang
    const label = (a.label ?? '').localeCompare(b.label ?? '')
    if (label !== 0) return label
    const provider = a.providerId.localeCompare(b.providerId)
    if (provider !== 0) return provider
    return a.url.localeCompare(b.url)
  })
}

/** Subtitles embedded in the selected stream, as provider-scoped flats. */
export function embeddedSubtitles(source: FlatSource | null | undefined): FlatSubtitle[] {
  if (!source?.subtitles || source.subtitles.length === 0) return []
  const group = normalizeSubtitles(source.subtitles, {
    id: source.providerId,
    name: source.providerName,
  })
  return group.items
}
