/**
 * How the screen presents itself while the player is fullscreen.
 *
 * React Native can host the video in a `Modal` and hide the status bar, but it
 * has no orientation lock and no way to get the navigation bar out of the way —
 * and without both, "fullscreen" means a landscape video with the phone's own
 * buttons drawn across the controls. So the last step lives behind a tiny
 * native module (`PixiFullscreen`, Kotlin:
 * `android/app/src/main/java/com/pixi/mobile/fullscreen`):
 *
 *  - lock the device landscape, restoring the previous orientation on exit;
 *  - hide the system bars (a swipe from the edge brings them back transiently).
 *
 * The player is the only caller, and it must keep working without the module:
 * if it is missing, fullscreen still works — it just leaves the rotation and
 * the bars to the viewer.
 *
 * Both calls are fire-and-forget on purpose. Presentation is best-effort and
 * must never be able to interrupt playback, so a rejection is logged here
 * rather than surfacing anywhere near the UI.
 */
import { NativeModules, Platform } from 'react-native'

interface FullscreenNative {
  /** Latch the current orientation, force sensor landscape, hide the system bars. */
  enterFullscreen(): Promise<boolean>
  /** Restore the latched orientation and system bars (no-op if nothing was latched). */
  exitFullscreen(): Promise<boolean>
}

const native: FullscreenNative | undefined =
  Platform.OS === 'android' ? (NativeModules.PixiFullscreen as FullscreenNative | undefined) : undefined

function report(where: string, error: unknown): void {
  console.warn(`[fullscreen] ${where} failed`, error)
}

/** Take over the screen for fullscreen video. Silently degrades to a no-op. */
export function enterFullscreen(): void {
  native?.enterFullscreen().catch((error: unknown) => report('enterFullscreen', error))
}

/** Hand the screen back exactly as it was before fullscreen. */
export function exitFullscreen(): void {
  native?.exitFullscreen().catch((error: unknown) => report('exitFullscreen', error))
}
