/**
 * The two halves the JS side cannot do itself: reading the installed version
 * and installing an APK (`PixiUpdate`, Kotlin:
 * `android/app/src/main/java/com/pixi/mobile/update`).
 *
 * Android will not install a package on its own, so `installApk` does the
 * whole dance and reports *what Android decided* instead of throwing:
 *
 *  - `permission` — the app is not yet allowed to install packages. It opens
 *    the system's "install unknown apps" screen for this package and the
 *    viewer taps Update again afterwards;
 *  - `open` — the APK downloaded and the system install prompt is up;
 *  - `missing` — no native module (not Android, or a dev build older than
 *    this file). Callers treat it as "no update possible".
 *
 * A rejection is a real failure (no connection, disk, HTTP status) and is
 * surfaced — see `useAppUpdate`.
 */
import { NativeModules, Platform } from 'react-native'

interface UpdateNative {
  getVersion(): Promise<string>
  installApk(url: string): Promise<'open' | 'permission'>
}

const native: UpdateNative | undefined =
  Platform.OS === 'android' ? (NativeModules.PixiUpdate as UpdateNative | undefined) : undefined

/** The installed app's `versionName`, or `null` when there is no module. */
export function currentVersion(): Promise<string | null> {
  return native?.getVersion() ?? Promise.resolve(null)
}

/** Download the APK and hand it to the system installer. */
export function installUpdate(url: string): Promise<'open' | 'permission' | 'missing'> {
  return native?.installApk(url) ?? Promise.resolve('missing')
}
