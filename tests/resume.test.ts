/**
 * Unit tests: where an episode opens when the viewer comes back to it
 * (src/pages/Watch/player/resume.ts).
 * Run: npm test
 *
 * Each rule guards a complaint rather than an abstraction: "it starts at 00:03
 * anyway", "it opened on the end card and finished itself", "it resumed past
 * the end of a re-encoded copy".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  FINISHED_PERCENT,
  MIN_RESUME_SECONDS,
  resolveCarriedPoint,
  resolveResumePoint,
} from '../src/pages/Watch/player/resume.ts'

test('a real session resumes at the second it stopped', () => {
  assert.equal(resolveResumePoint({ position: 754, percent: 51 }, 1440), 754)
})

test('a false start is too short to resume — open at zero', () => {
  // `MIN_RESUME_SECONDS - 1` is a tap or a reload, not a session.
  assert.equal(
    resolveResumePoint({ position: MIN_RESUME_SECONDS - 1, percent: 1 }, 1440),
    0,
  )
  assert.equal(resolveResumePoint({ position: 0, percent: 0 }, 1440), 0)
})

test('an episode at the finish threshold starts over instead of ending itself', () => {
  assert.equal(
    resolveResumePoint({ position: 1439, percent: FINISHED_PERCENT }, 1440),
    0,
  )
  // Percent alone is enough — the player has not measured anything yet.
  assert.equal(resolveResumePoint({ position: 1439, percent: 99 }, 0), 0)
  // …and so is the duration, when history only has seconds.
  assert.equal(resolveResumePoint({ position: 1439, percent: 0 }, 1440), 0)
  // One percent short of it is still a resume.
  assert.equal(resolveResumePoint({ position: 1300, percent: 90 }, 1440), 1300)
})

test('the saved second is checked against the measured duration', () => {
  // Same history, a trimmed copy: 754s is past 95% of a 780s file.
  assert.equal(resolveResumePoint({ position: 754, percent: 51 }, 780), 0)
  assert.equal(resolveResumePoint({ position: 754, percent: 51 }, 1440), 754)
})

test('an unknown duration does not disable resuming', () => {
  // VOD reports a duration on load; refusing to resume here would silently
  // switch the feature off for any player that reports late.
  assert.equal(resolveResumePoint({ position: 754, percent: 51 }, 0), 754)
})

test('nonsense resolves to zero rather than throwing', () => {
  assert.equal(resolveResumePoint({ position: Number.NaN, percent: 10 }, 1440), 0)
  assert.equal(resolveResumePoint({ position: Number.POSITIVE_INFINITY, percent: 10 }, 1440), 0)
  assert.equal(resolveResumePoint({ position: -60, percent: 10 }, 1440), 0)
})

/* ------------------------------------------------------------------ */
/* Switching source inside an episode                                  */
/* ------------------------------------------------------------------ */

test('switching source keeps the viewer exactly where they were', () => {
  // No thresholds here: 8 s in is mid-watch, and 1439/1440 is still watching —
  // a source switch must not restart either of them.
  assert.equal(resolveCarriedPoint({ episode: 1, position: 8 }, 1, 1440), 8)
  assert.equal(resolveCarriedPoint({ episode: 1, position: 1439 }, 1, 1440), 1439)
})

test('a carry from a different episode is refused', () => {
  assert.equal(resolveCarriedPoint({ episode: 3, position: 754 }, 4, 1440), 0)
  // No episode context on both sides is still a match (there is nothing to mix up).
  assert.equal(resolveCarriedPoint({ episode: null, position: 754 }, null, 1440), 754)
})

test('a missing or trivial carry resolves to zero', () => {
  assert.equal(resolveCarriedPoint(null, 1, 1440), 0)
  assert.equal(resolveCarriedPoint({ episode: 1, position: 0 }, 1, 1440), 0)
  assert.equal(resolveCarriedPoint({ episode: 1, position: 0.5 }, 1, 1440), 0)
})

test('a carry past the end of a shorter stream is clamped inside it', () => {
  // The replacement provider is trimmed: 1300 s does not exist in a 1000 s file.
  assert.equal(resolveCarriedPoint({ episode: 1, position: 1300 }, 1, 1000), 999)
  // An unknown duration cannot clamp.
  assert.equal(resolveCarriedPoint({ episode: 1, position: 1300 }, 1, 0), 1300)
})
