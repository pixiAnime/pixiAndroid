/**
 * Cue timing + parsing — the testable core of the subtitle overlay.
 *
 * The web hands WebVTT to Vidstack, which parses it natively and evaluates
 * "which cues are active right now" on every `timeupdate`. Android has no
 * `<video>`/TextTrackList, so this module owns both halves of that job:
 *
 *  - `parseWebVtt` turns a WebVTT document (or an SRT already converted by
 *    `@/extensions/subtitles/convert`) into plain `Cue` objects;
 *  - `selectActiveCues(cues, time, delay)` reproduces Vidstack's active-cue
 *    scan, including the subtitle-sync offset.
 *
 * Everything here is pure: no I/O, no React, no RN imports — so it can be
 * unit tested directly.
 */

/** One subtitle cue — the minimal `VTTCue` surface the player needs. */
export interface Cue {
  start: number
  end: number
  text: string
}

/** Sync range in seconds — beyond ±10s a source is usually just broken. */
export const MAX_SUBTITLE_DELAY = 10
/** Adjustment granularity — 0.1s matches VLC-style sync controls. */
export const DELAY_STEP = 0.1

/** Rounds to the 0.1s step and clamps to the ±10s delay domain. */
export function stepDelay(current: number, delta: number): number {
  const next = Math.round((current + delta) * 10) / 10
  return Math.min(MAX_SUBTITLE_DELAY, Math.max(-MAX_SUBTITLE_DELAY, next))
}

/** Locale-independent readout: `+1.2s` / `-0.3s` / `0.0s`. */
export function formatDelay(delay: number): string {
  if (delay === 0) return '0.0s'
  return `${delay > 0 ? '+' : ''}${delay.toFixed(1)}s`
}

/** `HH:MM:SS.mmm` (WebVTT) or `MM:SS.mmm` — both separators accepted. */
const LONG_TIME = /^(\d{1,3}):(\d{2}):(\d{2})[.,](\d{1,3})$/
const SHORT_TIME = /^(\d{1,2}):(\d{2})[.,](\d{1,3})$/

function parseTimestamp(raw: string): number | null {
  const token = raw.trim()
  const long = LONG_TIME.exec(token)
  if (long) {
    const ms = long[4].padEnd(3, '0')
    return Number(long[1]) * 3600 + Number(long[2]) * 60 + Number(long[3]) + Number(ms) / 1000
  }
  const short = SHORT_TIME.exec(token)
  if (short) {
    const ms = short[3].padEnd(3, '0')
    return Number(short[1]) * 60 + Number(short[2]) + Number(ms) / 1000
  }
  return null
}

const ENTITIES: Array<[RegExp, string]> = [
  [/&nbsp;/gi, ' '],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/&quot;/gi, '"'],
  [/&#0?39;/g, "'"],
  [/&#x27;/gi, "'"],
  [/&amp;/gi, '&'], // last: never re-decode an escaped entity
]

/**
 * Drops markup a cue may carry: `<i>`/`<b>`/`<c>` styling, `<v Speaker>`
 * voice tags and karaoke `<00:00:01.000>` timestamps. Newlines survive —
 * they are the cue's line breaks.
 */
export function stripCueTags(raw: string): string {
  let out = raw.replace(/<[^>]*>/g, '')
  for (const [pattern, replacement] of ENTITIES) out = out.replace(pattern, replacement)
  return out
}

/** Block headers that are never cues (WebVTT NOTE / STYLE / REGION). */
function isMetadataBlock(firstLine: string): boolean {
  const head = firstLine.trimStart()
  return head.startsWith('NOTE') || head.startsWith('STYLE') || head.startsWith('REGION')
}

/**
 * Parses a WebVTT document into cues, sorted by start time. Malformed blocks
 * are skipped — one bad cue must never break the overlay (spec §14).
 */
export function parseWebVtt(vtt: string): Cue[] {
  const document = vtt.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim()
  if (document.length === 0) return []

  const cues: Cue[] = []
  for (const block of document.split(/\n{2,}/)) {
    const lines = block.split('\n')
    if (lines.length === 0) continue
    const first = lines[0] ?? ''
    if (isMetadataBlock(first)) continue

    // Optional cue identifier line before the timing line.
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex === -1) continue

    const timing = lines[timeIndex] ?? ''
    const parts = timing.split('-->')
    if (parts.length !== 2) continue

    const start = parseTimestamp(parts[0])
    // Anything after the end timestamp is cue settings (`line:`, `align:`, …).
    const endToken = (parts[1] ?? '').trim().split(/\s+/)[0] ?? ''
    const end = parseTimestamp(endToken)
    if (start === null || end === null || end < start) continue

    const text = stripCueTags(lines.slice(timeIndex + 1).join('\n')).trim()
    if (text.length === 0) continue

    cues.push({ start, end, text })
  }

  return cues.sort((a, b) => a.start - b.start)
}

/**
 * Cues covering `time`, shifted by `delay` seconds — the port of the web's
 * `applyCueDelay` (which mutates Vidstack's cue times) into a pure read:
 *
 *   start = max(0, originalStart + delay)   (a cue cannot fire before t=0)
 *   end   = max(start, originalEnd + delay)
 *
 * Shifting from the originals (rather than from the current values) is what
 * keeps repeated ±0.1s adjustments drift-free. Boundary rule matches the
 * media spec: `start <= time < end`.
 */
export function selectActiveCues(cues: Cue[], time: number, delay = 0): Cue[] {
  if (cues.length === 0 || !Number.isFinite(time)) return []

  const active: Cue[] = []
  for (const cue of cues) {
    const start = Math.max(0, cue.start + delay)
    const end = Math.max(start, cue.end + delay)
    if (time >= start && time < end) active.push(cue)
  }
  return active
}
