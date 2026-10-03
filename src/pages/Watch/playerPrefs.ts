/**
 * Player preferences the app remembers between sessions.
 *
 * These are the two settings the viewer sets once and expects to keep — cue
 * size and whether an episode rolls into the next one. They live in the
 * `localStorage` shim the shared stores already use (MMKV on Android), under a
 * `pixiandroid.` key: this is mobile-owned player state, not something the web
 * has an opinion about, so it must not land in a synced file.
 *
 * Reads are defensive — a value written by a future version, or a storage that
 * threw at module load, has to fall back to the default rather than break the
 * player.
 */
import { BOOST_CHOICES, BOOST_RATE, DEFAULT_SKIP_SECONDS, SKIP_CHOICES } from './tapGestures'
import type { SubtitleSize } from './subtitleScale'

const SUBTITLE_SIZE_KEY = 'pixiandroid.player.subtitleSize'
const AUTO_NEXT_KEY = 'pixiandroid.player.autoNext'
const SKIP_SECONDS_KEY = 'pixiandroid.player.skipSeconds'
const HOLD_RATE_KEY = 'pixiandroid.player.holdRate'

/** Cue sizes the settings menu offers, smallest first. */
export const SUBTITLE_SIZE_CYCLE: SubtitleSize[] = ['small', 'medium', 'large']


function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // A read-only store must not take the player down with it.
  }
}

export function readSubtitleSize(fallback: SubtitleSize): SubtitleSize {
  const value = read(SUBTITLE_SIZE_KEY)
  return SUBTITLE_SIZE_CYCLE.find((size) => size === value) ?? fallback
}

export function writeSubtitleSize(size: SubtitleSize): void {
  write(SUBTITLE_SIZE_KEY, size)
}

/** Autoplay of the next episode is on by default, like every binge app. */
export function readAutoNext(): boolean {
  return read(AUTO_NEXT_KEY) !== 'false'
}

export function writeAutoNext(value: boolean): void {
  write(AUTO_NEXT_KEY, value ? 'true' : 'false')
}

/** How far the skip buttons and the double-tap gesture jump. */
export function readSkipSeconds(): number {
  const value = Number(read(SKIP_SECONDS_KEY))
  return (SKIP_CHOICES as readonly number[]).includes(value) ? value : DEFAULT_SKIP_SECONDS
}

export function writeSkipSeconds(seconds: number): void {
  write(SKIP_SECONDS_KEY, String(seconds))
}

/** The rate a press-and-hold runs at. */
export function readHoldRate(): number {
  const value = Number(read(HOLD_RATE_KEY))
  return (BOOST_CHOICES as readonly number[]).includes(value) ? value : BOOST_RATE
}

export function writeHoldRate(rate: number): void {
  write(HOLD_RATE_KEY, String(rate))
}
