/**
 * Handing the stream on screen to another app — "open in external player".
 *
 * One call (`PixiExternal`, Kotlin:
 * `android/app/src/main/java/com/pixi/mobile/external`) fires the system's
 * `ACTION_VIEW` chooser over `video/*`, so the viewer picks their own player
 * and the app never has to know which ones exist.
 *
 * Resolves `false` when nothing on the device can open a video — a normal
 * answer with copy behind it, not an error, so it is not caught as one. The
 * player is the only caller; it pauses first, because two players talking at
 * once is the one outcome this must not produce.
 */
import { NativeModules, Platform } from 'react-native'

interface ExternalNative {
  openInPlayer(uri: string): Promise<boolean>
}

const native: ExternalNative | undefined =
  Platform.OS === 'android' ? (NativeModules.PixiExternal as ExternalNative | undefined) : undefined

/** Hand [uri] to the system's video players. `false` = no app can open it. */
export function openInExternalPlayer(uri: string): Promise<boolean> {
  return native?.openInPlayer(uri) ?? Promise.resolve(false)
}
