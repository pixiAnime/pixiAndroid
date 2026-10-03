/**
 * Where an episode should open when the viewer comes back to it.
 *
 * Pure on purpose: the rules are thresholds, not I/O, so they are unit tested
 * without a renderer (`tests/resume.test.ts`). The player calls this once,
 * inside `onLoad` — the first moment the duration is known — and seeks there.
 *
 * Three cases answer "do not resume":
 *
 *  1. **nothing worth resuming.** A few seconds in is a false start (a tap, a
 *     reload), not a session; opening at 00:03 would read as "it forgot".
 *  2. **the episode is effectively finished.** Resuming at 95%+ means opening
 *     on the end card, where the first press of play would end the episode.
 *  3. **the position outlived the media.** The saved seconds are compared with
 *     the *measured* duration too, so a re-encoded or trimmed copy of the same
 *     episode cannot land past its own end.
 *
 * Percent comes straight from the history entry (`0–100`) and is checked first
 * because it is known even when the player reports no duration.
 */

/** Below this, a saved position is a false start rather than a session. */
export const MIN_RESUME_SECONDS = 5

/** At this percent (of history or of the duration) the episode is "watched". */
export const FINISHED_PERCENT = 95

/** What the last session recorded for one episode. */
export interface SavedProgress {
  /** Position in seconds; 0 when the episode never really played. */
  position: number
  /** Whole percent 0–100 as the player last reported it. */
  percent: number
}

/**
 * The second to open on, or `0` to start at the beginning.
 *
 * `duration` is the measured media duration in seconds; `0` (or anything
 * non-positive) means "not measured yet", which skips rule 3 rather than
 * silently disabling the feature — VOD streams report a duration on load.
 */
export function resolveResumePoint(saved: SavedProgress, duration: number): number {
  const position = saved.position
  if (!Number.isFinite(position) || position < MIN_RESUME_SECONDS) return 0
  if (saved.percent >= FINISHED_PERCENT) return 0
  if (duration > 0 && position >= duration * (FINISHED_PERCENT / 100)) return 0
  return position
}
