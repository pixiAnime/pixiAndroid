package com.pixi.mobile.external

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager

/**
 * "Open in external player" — handing the stream the viewer is watching to
 * another app (VLC, MX Player, …).
 *
 * The intent is deliberately plain: `ACTION_VIEW` with the wildcard `video`
 * mime, always through [Intent.createChooser] so the viewer picks rather than
 * the app guessing which player is the default.
 *
 * The wildcard and not the container the source declared (VIDEO_MIME is the
 * `video` wildcard): an HLS manifest's own type (`application/x-mpegURL`)
 * resolves against far fewer apps, and every player works out what it just
 * opened from the URL anyway.
 *
 * Resolves `true` when a player was offered, `false` when none was — a
 * *result*, not a rejection, because "this device has nothing that can open a
 * video" is a state the UI has copy for. The JS side is
 * `src/platform/external.ts`.
 */
class PixiExternalModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun openInPlayer(uri: String, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      // Called while there is no resumed activity: nothing to hand off to.
      promise.resolve(false)
      return
    }

    val view = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(uri), VIDEO_MIME)
    // Package visibility (Android 11+): without the manifest's <queries> this
    // always answers null even with a dozen players installed.
    if (view.resolveActivity(activity.packageManager) == null) {
      promise.resolve(false)
      return
    }

    try {
      activity.startActivity(Intent.createChooser(view, null))
      promise.resolve(true)
    } catch (error: ActivityNotFoundException) {
      promise.resolve(false)
    }
  }

  companion object {
    const val NAME = "PixiExternal"
    const val VIDEO_MIME = "video/*"
  }
}

/** Exposes [PixiExternalModule] (registered in MainApplication). */
class PixiExternalPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(PixiExternalModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
