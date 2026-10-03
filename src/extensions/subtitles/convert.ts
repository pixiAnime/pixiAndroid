/**
 * Subtitle text conversion — dedicated subtitle processing layer (spec §14).
 * Pure functions, unit tested: SRT → WebVTT. ASS/SSA is kept as metadata
 * only (rendering needs a heavyweight renderer — see docs/extensions.md).
 */

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/

function toVttTime(match: RegExpExecArray): string {
  const [, hh, mm, ss, ms] = match
  return `${hh.padStart(2, '0')}:${mm}:${ss}.${ms.padEnd(3, '0')}`
}

/** Convert SRT captions to a WebVTT document. Returns null on garbage input. */
export function srtToVtt(srt: string): string | null {
  const text = srt.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim()
  if (text.length === 0) return null
  if (/^WEBVTT/.test(text)) return text // already VTT

  const blocks = text.split(/\n{2,}/)
  const cues: string[] = []
  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0)
    if (lines.length === 0) continue

    // Optional numeric counter line, then "start --> end".
    let timeLineIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeLineIndex === -1) continue

    const timeLine = lines[timeLineIndex]
    const parts = timeLine.split('-->')
    if (parts.length !== 2) continue
    const startMatch = TIME_RE.exec(parts[0])
    const endMatch = TIME_RE.exec(parts[1])
    if (!startMatch || !endMatch) continue

    const content = lines
      .slice(timeLineIndex + 1)
      .join('\n')
      .replace(/\{\\.*?\}/g, '') // strip ASS-ish inline tags some SRTs carry
      .trim()
    if (content.length === 0) continue

    cues.push(`${toVttTime(startMatch)} --> ${toVttTime(endMatch)}\n${content}`)
    timeLineIndex = -1
  }

  if (cues.length === 0) return null
  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

/** Heuristic: does this text look like SRT (or convertible captions)? */
export function looksLikeSrt(text: string): boolean {
  return /\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(text)
}
