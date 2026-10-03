package com.pixi.mobile.fullscreen

import android.app.Activity
import android.content.pm.ActivityInfo
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * How the screen presents itself while the player is fullscreen.
 *
 * React Native can put the video in a `Modal` and hide the status bar, but it
 * cannot do the two things that make fullscreen actually usable on Android:
 *
 *  - **orientation** — there is no orientation lock in JS, yet tapping
 *    fullscreen has to turn the phone by itself instead of waiting for the
 *    viewer to rotate it. [enterFullscreen] latches whatever orientation the
 *    activity had and forces `SCREEN_ORIENTATION_SENSOR_LANDSCAPE`, which
 *    follows the sensor even when the system auto-rotate toggle is off.
 *  - **the navigation bar** — the Modal's window is laid out edge to edge, so
 *    the bar (a *side* one in landscape) is drawn on top of the rightmost
 *    controls. React Native's insets do not help here: its Modal only sets
 *    `fitsSystemWindows` on a wrapper whose DecorView has already consumed them.
 *    Hiding the bar is what a video player is supposed to do; a swipe from the
 *    edge brings it back transiently.
 *
 * [exitFullscreen] puts back exactly what was latched — the orientation and
 * the activity's own `systemUiVisibility` — so leaving fullscreen is invisible,
 * and it is a no-op when nothing was ever latched. Both methods resolve with a
 * boolean rather than throwing: presentation is best-effort and must never be
 * able to block playback. The JS side lives in `src/platform/fullscreen.ts`.
 */
class PixiFullscreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** Orientation to restore, or null while the activity is free to rotate. */
  private var latchedOrientation: Int? = null

  /** System-UI flags to restore, or null while the bars are ours to hide. */
  private var latchedSystemUi: Int? = null

  @ReactMethod
  fun enterFullscreen(promise: Promise) = onActivity(promise) { activity ->
    latch(activity)
    activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    hideSystemBars(activity)
    true
  }

  @ReactMethod
  fun exitFullscreen(promise: Promise) = onActivity(promise) { activity ->
    showSystemBars(activity)
    val restore = latchedOrientation
    if (restore != null) {
      activity.requestedOrientation = restore
      latchedOrientation = null
    }
    true
  }

  /** Remembers the presentation state exactly once per fullscreen visit. */
  private fun latch(activity: Activity) {
    if (latchedOrientation == null) {
      latchedOrientation = activity.requestedOrientation
    }
    if (latchedSystemUi == null) {
      latchedSystemUi = activity.window.decorView.systemUiVisibility
    }
  }

  private fun hideSystemBars(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val controller = activity.window.insetsController ?: return
      controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      controller.hide(WindowInsets.Type.systemBars())
      return
    }
    // Pre-Android 11: legacy flags, immersive so the bars slide away and the
    // activity's own layout keeps running underneath them.
    activity.window.decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }

  private fun showSystemBars(activity: Activity) {
    val restore = latchedSystemUi
    if (restore == null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.window.insetsController?.show(WindowInsets.Type.systemBars())
    }
    activity.window.decorView.systemUiVisibility = restore
    latchedSystemUi = null
  }

  /** Applies [block] on the UI thread (presentation is a view-tree operation). */
  private fun onActivity(promise: Promise, block: (Activity) -> Boolean) {
    // `getCurrentActivity()` is deprecated since RN 0.80; the activity is read
    // per call (never stored) exactly as its replacement prescribes.
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      // Called while there is no resumed activity (teardown): nothing to do.
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      try {
        promise.resolve(block(activity))
      } catch (error: RuntimeException) {
        promise.reject(ERROR_CODE, error)
      }
    }
  }

  companion object {
    const val NAME = "PixiFullscreen"
    const val ERROR_CODE = "E_FULLSCREEN"
  }
}
