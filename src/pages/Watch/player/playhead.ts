/**
 * playhead — the high-frequency half of playback state, kept out of `Player`.
 *
 * `onProgress` fires every 250 ms. In the monolith that tick re-rendered the
 * *entire* player: the settings tree, the gesture layer, the cue box, every
 * style recalculation — four times a second, forever. Only two leaves actually
 * draw the playhead, the scrubber and the subtitle overlay, so the numbers
 * live here and those two subscribe. `Player` reads them through `getState()`
 * inside handlers and never re-renders because of them.
 *
 * Module-level because there is exactly one video surface: `Watch` renders one
 * `Player`, and the per-source reset effect zeroes this on every source change
 * — the same reset the component state used to do. Nothing persists between
 * episodes, so a second `Player` would only ever be a different *moment* of the
 * same one.
 */
import { create } from 'zustand'

export interface Playhead {
  /** Playhead in seconds, from `onProgress`. */
  position: number
  /** Media duration in seconds; 0 until `onLoad` fires. */
  duration: number
  /** How far the buffer reaches, in seconds (`playableDuration`). */
  buffered: number
}

const ZERO: Playhead = { position: 0, duration: 0, buffered: 0 }

export const usePlayhead = create<Playhead>(() => ({ ...ZERO }))

/** Write from an event handler — safe to call without subscribing. */
export function setPlayhead(patch: Partial<Playhead>): void {
  usePlayhead.setState(patch)
}

/** Read from a callback that must not re-render. */
export function readPlayhead(): Playhead {
  return usePlayhead.getState()
}

/** A new source (or a replay from the end) starts from zero. */
export function resetPlayhead(): void {
  usePlayhead.setState({ ...ZERO })
}
