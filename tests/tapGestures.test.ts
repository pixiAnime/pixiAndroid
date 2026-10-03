/**
 * Unit tests: the surface gesture arbitration (src/pages/Watch/tapGestures.ts).
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  HOLD_THRESHOLD_MS,
  IDLE,
  stepGesture,
  zoneFor,
  type GestureState,
  type SurfaceAction,
  type SurfaceEvent,
} from '../src/pages/Watch/tapGestures.ts'

/** Feed a sequence and collect the actions, ending in the final state. */
function run(events: SurfaceEvent[], from: GestureState = IDLE) {
  const actions: SurfaceAction[] = []
  let state = from
  for (const event of events) {
    const step = stepGesture(state, event)
    state = step.state
    if (step.action) actions.push(step.action)
  }
  return { actions, state }
}

test('the documented timings cannot collide: the tap window opens after the hold', () => {
  assert.ok(HOLD_THRESHOLD_MS > 0)
  assert.ok(
    HOLD_THRESHOLD_MS > 200,
    'a hold threshold below a real tap would turn taps into holds',
  )
})

test('a lone tap toggles playback, but only once the window closes', () => {
  const { actions, state } = run([
    { type: 'down', zone: 'forward' },
    { type: 'up' },
    { type: 'expire' },
  ])
  assert.deepEqual(actions, [{ type: 'toggle' }])
  assert.equal(state.phase, 'idle')
})

test('a touch arms only the hold: the tap window opens on release', () => {
  const down = stepGesture(IDLE, { type: 'down', zone: 'back' })
  assert.deepEqual(down.timers, { expire: false, hold: true })
  assert.equal(down.state.phase, 'pending')

  const up = stepGesture(down.state, { type: 'up' })
  assert.deepEqual(up.timers, { expire: true, hold: false })
  assert.equal(up.state.phase, 'pending')
  assert.equal(up.action, undefined)
})

test('a hold outlasts the tap window, because no window is open while down', () => {
  // The device bug this pins down: with a tap window running from `down`, a
  // 1-second press resolved as a toggle at 280 ms and the hold never happened.
  const down = stepGesture(IDLE, { type: 'down', zone: 'forward' })
  assert.equal(stepGesture(down.state, { type: 'expire' }).action, undefined)
  const held = stepGesture(down.state, { type: 'hold' })
  assert.deepEqual(held.action, { type: 'boost' })
  assert.deepEqual(held.timers, { expire: false, hold: false })
})

test('a resolved gesture leaves no timer armed', () => {
  const settled = stepGesture({ phase: 'pending', zone: 'forward', held: false }, { type: 'expire' })
  assert.deepEqual(settled.timers, { expire: false, hold: false })
  assert.deepEqual(
    stepGesture({ phase: 'doubling', zone: 'forward', held: true }, { type: 'up' }).timers,
    { expire: false, hold: false },
  )
  assert.deepEqual(stepGesture({ phase: 'boosting', zone: 'forward' }, { type: 'up' }).timers, {
    expire: false,
    hold: false,
  })
})

test('two taps in the same half seek once, and never toggle', () => {
  const { actions, state } = run([
    { type: 'down', zone: 'forward' },
    { type: 'up' },
    { type: 'down', zone: 'forward' },
    { type: 'up' },
    { type: 'expire' }, // a stale timer from the first tap firing late
  ])
  assert.deepEqual(actions, [{ type: 'skip', zone: 'forward' }])
  assert.equal(state.phase, 'idle')
})

test('a double tap takes the direction of its second tap', () => {
  const { actions } = run([
    { type: 'down', zone: 'back' },
    { type: 'up' },
    { type: 'down', zone: 'forward' },
    { type: 'up' },
  ])
  assert.deepEqual(actions, [{ type: 'skip', zone: 'forward' }])
})

test('a press and hold boosts, and lifting restores the rate', () => {
  const { actions, state } = run([
    { type: 'down', zone: 'back' },
    { type: 'hold' },
    { type: 'up' },
    { type: 'expire' },
  ])
  assert.deepEqual(actions, [{ type: 'boost' }, { type: 'unboost' }])
  assert.equal(state.phase, 'idle')
})

test('a hold releases the single-tap timer, so a long press never toggles', () => {
  const held = stepGesture({ phase: 'pending', zone: 'forward', held: true }, { type: 'hold' })
  assert.deepEqual(held.timers, { expire: false, hold: false })
  assert.deepEqual(held.action, { type: 'boost' })
})

test('a second tap during a double tap starts a fresh gesture, not a third action', () => {
  const { actions, state } = run([
    { type: 'down', zone: 'forward' },
    { type: 'up' },
    { type: 'down', zone: 'forward' },
    { type: 'down', zone: 'back' }, // third finger, before the second released
    { type: 'up' },
  ])
  assert.deepEqual(actions, [])
  assert.equal(state.phase, 'pending')
})

test('timers that fire out of order are absorbed', () => {
  // `expire` after the pair resolved, `hold` with nothing down.
  const afterPair = run([
    { type: 'down', zone: 'forward' },
    { type: 'up' },
    { type: 'down', zone: 'forward' },
    { type: 'up' },
  ]).state
  assert.equal(stepGesture(afterPair, { type: 'expire' }).action, undefined)
  assert.equal(stepGesture(afterPair, { type: 'hold' }).action, undefined)
  assert.equal(stepGesture(IDLE, { type: 'up' }).action, undefined)
})

test('the surface splits down the middle', () => {
  assert.equal(zoneFor(0, 1000), 'back')
  assert.equal(zoneFor(499, 1000), 'back')
  assert.equal(zoneFor(500, 1000), 'forward')
  assert.equal(zoneFor(999, 1000), 'forward')
})
