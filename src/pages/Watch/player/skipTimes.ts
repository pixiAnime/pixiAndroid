/**
 * Which skip interval, if any, the viewer is sitting in right now.
 *
 * Pure on purpose: the player evaluates this four times a second, and the
 * rules — how early the button appears, when an interval stops being skippable,
 * how a resume position past the opening is treated — are the kind of thing
 * that deserves a test rather than an inline comparison.
 */
import type { SkipInterval } from '@/api/aniskip'

/**
 * Jikan reports the per-episode length as prose — `"24 min per ep"` — while
 * Aniskip scores its matches against a number of seconds. `parseFloat` stops
 * at the first character that is not part of the number, which is exactly what
 * is wanted here; anything unparseable means "we don't know", not zero.
 */
export function episodeLengthSeconds(duration: string | undefined): number | undefined {
  const minutes = Number.parseFloat(duration ?? '')
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : undefined
}

/**
 * How long before the interval the button appears. Zero would make it pop in
 * on the frame it becomes skippable — too late to read, and impossible to
 * hit with a thumb that is still travelling.
 */
export const SKIP_LEAD_IN_SECONDS = 2

/**
 * The interval to offer at `position`, or `null`.
 *
 * An interval is offered from `startTime - SKIP_LEAD_IN_SECONDS` up to — and
 * including — its `endTime`: seeking to exactly the end lands on the first
 * frame after the opening, which is what the button promises. A resume that
 * drops the viewer past the end is not offered one, because the thing it
 * skips is already behind them.
 */
export function activeSkipInterval(
  intervals: readonly SkipInterval[] | undefined,
  position: number,
): SkipInterval | null {
  if (!intervals || intervals.length === 0) return null
  let best: SkipInterval | null = null
  for (const interval of intervals) {
    const from = interval.startTime - SKIP_LEAD_IN_SECONDS
    if (position < from || position > interval.endTime) continue
    // Opening and ending rarely overlap, but a malformed submission could
    // produce two live intervals; the nearest start wins so the button does
    // not jump between labels.
    if (!best || interval.startTime > best.startTime) best = interval
  }
  return best
}