/**
 * The YouTube gesture set for the video surface, as a pure state machine.
 *
 * Three gestures share one small area and none of them may swallow another, so
 * the arbitration lives here rather than in the component:
 *
 *  - **single tap** → play/pause. It has to *wait* for the double-tap window
 *    to close, which is why the tap feels instant only once we know it was
 *    alone.
 *  - **double tap** → seek ±`SKIP_SECONDS`, in the half that was tapped. The
 *    direction is the *second* tap's, so a viewer can correct a half-missed
 *    first tap.
 *  - **press and hold** → temporary `BOOST_RATE` (2×) for as long as the finger
 *    is down, restoring the chosen rate on release. YouTube's speed-up.
 *
 * The component owns two timers and translates them into events; no wall-clock
 * time reaches this module, which is what keeps it testable.
 */

/** Which half of the surface a touch landed in. */
export type SurfaceZone = 'back' | 'forward'

/** How long a released tap waits for a second one, in ms. */
export const DOUBLE_TAP_WINDOW_MS = 280
/**
 * How long a touch must stay down before it becomes a hold, in ms. It has to be
 * comfortably longer than a real tap (~80-120 ms) and must not overlap the
 * double-tap window above, which only opens once the finger is up.
 */
export const HOLD_THRESHOLD_MS = 420
/** Rate applied while a hold is in progress (YouTube's "speed up"). */
export const BOOST_RATE = 2

/** How far a skip travels by default, in seconds. */
export const DEFAULT_SKIP_SECONDS = 10
/** Skip steps and hold rates the settings menu offers. */
export const SKIP_CHOICES = [5, 10, 15, 30] as const
export const BOOST_CHOICES = [1.5, 2, 3] as const

export type SurfaceEvent =
  /** A finger went down; `zone` is the half of the surface it landed in. */
  | { type: 'down'; zone: SurfaceZone }
  /** That finger came up. */
  | { type: 'up' }
  /** The double-tap window closed with no second tap: it was a single tap. */
  | { type: 'expire' }
  /** The hold threshold elapsed while still down. */
  | { type: 'hold' }

export type SurfaceAction =
  | { type: 'toggle' }
  | { type: 'skip'; zone: SurfaceZone }
  | { type: 'boost' }
  | { type: 'unboost' }

export type GesturePhase =
  /** Nothing in progress. */
  | 'idle'
  /** One tap down, or up within the window: a second tap would make it a double. */
  | 'pending'
  /** The second tap of a pair is down (or just came up). */
  | 'doubling'
  /** Held past the threshold: boosting until the finger lifts. */
  | 'boosting'

export interface GestureState {
  phase: GesturePhase
  /** Zone of the tap that decides the direction, used while `pending`/`doubling`. */
  zone: SurfaceZone
  /** A finger is still down — the tap window may not resolve while this is true. */
  held: boolean
}

export const IDLE: GestureState = { phase: 'idle', zone: 'forward', held: false }

export interface GestureStep {
  state: GestureState
  /** The action to run, if this transition produced one. */
  action?: SurfaceAction
  /**
   * Which timers should be **running** after this transition — an absolute
   * description, not "re-arm these". The caller syncs its timers to it, so
   * `up` on a pending tap has to keep the double-tap window alive (that is how
   * a second tap can still turn the pair into a double) while dropping the hold
   * threshold, whose finger is already gone.
   */
  timers: { expire: boolean; hold: boolean }
}

const NONE = { expire: false, hold: false }

/**
 * One event, one step. Pure: same `(state, event)` always gives the same
 * result, and out-of-order events (`expire`/`hold` firing after `up`) are
 * absorbed by the phase rather than throwing.
 */
export function stepGesture(state: GestureState, event: SurfaceEvent): GestureStep {
  switch (event.type) {
    case 'down':
      if (state.phase === 'pending') {
        // Second tap: forget the single-tap window, wait for its release so a
        // third tap cannot extend the pair into a third action. No hold timer
        // either — this touch is a tap, not a press.
        return { state: { phase: 'doubling', zone: event.zone, held: true }, timers: NONE }
      }
      // A fresh touch (or one landing while a hold/pair is still resolving):
      // only the hold threshold is armed. The single-tap window deliberately
      // does *not* start yet — a finger resting on the picture for a second is
      // a hold, and a tap window that expired under it would steal the gesture
      // before the hold threshold was ever reached.
      return {
        state: { phase: 'pending', zone: event.zone, held: true },
        timers: { expire: false, hold: true },
      }

    case 'up':
      if (state.phase === 'doubling') {
        return {
          state: IDLE,
          action: { type: 'skip', zone: state.zone },
          timers: NONE,
        }
      }
      if (state.phase === 'boosting') {
        return { state: IDLE, action: { type: 'unboost' }, timers: NONE }
      }
      // `pending`: the release is what starts the single-tap window — only now
      // can a second tap still turn it into a pair.
      return { state: { ...state, held: false }, timers: { expire: true, hold: false } }

    case 'expire':
      // A window cannot close under a finger that is still down: that is a
      // press-and-hold, and the hold threshold is the only thing that may
      // resolve it.
      if (state.phase !== 'pending' || state.held) return { state, timers: NONE }
      return { state: IDLE, action: { type: 'toggle' }, timers: NONE }

    case 'hold':
      if (state.phase !== 'pending' || !state.held) return { state, timers: NONE }
      return {
        state: { ...state, phase: 'boosting' },
        action: { type: 'boost' },
        timers: NONE,
      }

    default:
      return { state, timers: NONE }
  }
}

/** Which half of a surface a touch at `x` in a surface `width` wide belongs to. */
export function zoneFor(x: number, width: number): SurfaceZone {
  return x < width / 2 ? 'back' : 'forward'
}
