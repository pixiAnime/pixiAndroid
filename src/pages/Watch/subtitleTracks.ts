/**
 * Subtitle track resolution — the mobile port of
 * `pixiWeb/src/extensions/subtitles/tracks.ts`.
 *
 * On the web every subtitle file is fetched through the pixiClient bridge and
 * handed to Vidstack as a same-origin Blob URL. Android has no CORS layer, so
 * the file is fetched directly with the provider's own (sanitized) headers —
 * the same request boundary rule as the web (`sanitizeHeaders` runs again
 * here; never trust upstream), and the same fail-soft contract: a broken
 * subtitle never breaks playback.
 *
 * Instead of a Blob URL the result is a parsed `Cue[]`, because the overlay
 * (not the player) is what renders it.
 */
import { srtToVtt, type FlatSubtitle } from '@/extensions'
import { SUBTITLE_TIMEOUT_MS } from '@/extensions/runtime/config'
import { sanitizeHeaders } from '@/extensions/runtime/policy'

import { parseWebVtt, type Cue } from './subtitleCues'

export interface ResolvedSubtitleTrack {
  key: string
  language: string
  label: string
  format: FlatSubtitle['format']
  cues: Cue[]
}

/**
 * Key prefix for text tracks that live *inside* the media container (ExoPlayer
 * discovers them in the HLS master playlist / MP4). Those are rendered
 * natively; everything without this prefix is side-loaded and rendered by the
 * overlay.
 */
export const NATIVE_TRACK_KEY_PREFIX = 'native:'

/** Container track reported by `react-native-video`'s `onLoad`. */
export interface NativeTextTrack {
  index: number
  title?: string
  language?: string
  type?: string
}

export function nativeTrackKey(index: number): string {
  return `${NATIVE_TRACK_KEY_PREFIX}${index}`
}

/** `native:3` → 3, anything else → null (so one state drives both renderers). */
export function parseNativeTrackKey(key: string | null | undefined): number | null {
  if (!key || !key.startsWith(NATIVE_TRACK_KEY_PREFIX)) return null
  const index = Number(key.slice(NATIVE_TRACK_KEY_PREFIX.length))
  return Number.isInteger(index) && index >= 0 ? index : null
}

/**
 * Fetches one subtitle file and parses it into cues.
 * Returns null on every failure (HTTP error, timeout, unparseable body) and
 * for ASS/SSA — that format stays metadata-only until a renderer exists.
 */
export async function resolveSubtitleTrack(
  sub: FlatSubtitle,
): Promise<ResolvedSubtitleTrack | null> {
  if (sub.format === 'ass') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUBTITLE_TIMEOUT_MS)
  try {
    const headers = sanitizeHeaders(sub.headers)
    const response = await fetch(sub.url, {
      headers: headers ?? undefined,
      signal: controller.signal,
    })
    if (!response.ok) return null
    const body = await response.text()

    // srt converts in the subtitle layer; anything else must already look
    // like WebVTT before it reaches the overlay.
    const vtt =
      sub.format === 'srt'
        ? srtToVtt(body)
        : /^WEBVTT\b/.test(body.trimStart())
          ? body
          : null
    if (!vtt) return null

    const cues = parseWebVtt(vtt)
    if (cues.length === 0) return null

    return {
      key: sub.key,
      language: sub.language,
      label: sub.label ?? sub.language,
      format: sub.format,
      cues,
    }
  } catch {
    return null // isolation: subtitle failure must never break playback
  } finally {
    clearTimeout(timer)
  }
}
