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

/** A live position captured when a source changed, tagged with its episode. */
export interface CarriedPosition {
  /** Episode the position belongs to; `null` when there is no episode context. */
  episode: number | null
  /** Position in seconds at the moment the source changed. */
  position: number
}

/**
 * The second to open a **new source of the same episode** at.
 *
 * Unlike `resolveResumePoint`, this is not a history resume: switching the
 * provider mid-episode must keep the viewer exactly where they were, whatever
 * that position is — the 5 s "false start" floor and the 95 % "finished"
 * ceiling would both be wrong here, because the viewer is watching *now*.
 *
 * Two guards keep it honest: the carried position only applies to the episode
 * it was captured for (an episode change must not inherit the previous one's
 * second), and it is clamped inside a shorter replacement stream so a source
 * that is trimmed cannot land past its own end.
 *
 * Returns `0` when there is nothing to carry.
 */
export function resolveCarriedPoint(
  carried: CarriedPosition | null,
  episode: number | null,
  duration: number,
): number {
  if (!carried || carried.episode !== episode) return 0
  const position = carried.position
  if (!Number.isFinite(position) || position < 1) return 0
  if (duration > 0 && position >= duration) return Math.max(0, duration - 1)
  return position
}
