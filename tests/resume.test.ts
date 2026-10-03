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
