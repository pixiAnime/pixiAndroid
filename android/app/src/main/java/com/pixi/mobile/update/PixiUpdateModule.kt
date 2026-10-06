package com.pixi.mobile.update

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The install half of the in-app updater (`src/hooks/useAppUpdate.ts` owns the
 * check).
 *
 * Two calls, both deliberately quiet:
 *
 *  - [getVersion] reads `versionName` from `PackageManager` rather than a
 *    `BuildConfig` constant, so it answers for whatever is *actually
 *    installed* — including a release APK signed and sideloaded elsewhere.
 *  - [installApk] asks Android for permission, downloads the APK into the
 *    cache dir, and hands the file to the system installer through the
 *    `FileProvider` declared in the manifest. It never starts an install on
 *    its own: on Android that is a user decision, and the prompt is the point.
 *
 * Permission is checked *before* the download. Spending a minute pulling 60 MB
 * only to be refused would be the wrong order, and the "permission" answer
 * already opened the screen where the viewer can fix it.
 *
 * `HttpURLConnection` rather than OkHttp: one redirecting GET with no auth,
 * no progress stream and no retry policy — the JDK client is the shorter,
 * dependency-free answer.
 */
class PixiUpdateModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** `versionName` of the installed package ("0.1.36"). */
  @ReactMethod
  fun getVersion(promise: Promise) {
    try {
      val info = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
      promise.resolve(info.versionName ?: "")
    } catch (error: Exception) {
      promise.reject(NAME, "Could not read the installed version.", error)
    }
  }

  /**
   * Download [url] into the cache dir and open the system install prompt.
   * Resolves [PERMISSION] when the app is not allowed to install packages (the
   * manage-unknown-app-sources screen was just opened), [OPEN] when the prompt
   * is up, and rejects on a failed download.
   */
  @ReactMethod
  fun installApk(url: String, promise: Promise) {
    val context = reactContext

    // Per-app install permission exists only from O (26). Older builds gate
    // the same thing behind the global "unknown sources" toggle, which the
    // install prompt itself offers — so on API < 26 there is nothing to ask.
    val needsInstallPermission =
      android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O &&
        !context.packageManager.canRequestPackageInstalls()

    if (needsInstallPermission) {
      try {
        context.startActivity(
          Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      } catch (error: ActivityNotFoundException) {
        promise.reject(NAME, "This device cannot grant install permission.", error)
        return
      }
      promise.resolve(PERMISSION)
      return
    }

    try {
      val apk = download(url, File(context.cacheDir, APK_NAME))
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apk)
      context.startActivity(
        Intent(Intent.ACTION_VIEW)
          .setDataAndType(uri, APK_MIME)
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      promise.resolve(OPEN)
    } catch (error: IOException) {
      promise.reject(NAME, error.message ?: "Could not download the update.", error)
    }
  }

  /**
   * Stream [url] into [target], replacing whatever was there: a previous
   * half-finished download must never be what gets installed.
   *
   * GitHub's download URL 302s to a signed storage URL on the same scheme, so
   * the default redirect handling carries it across.
   */
  private fun download(url: String, target: File): File {
    target.delete()
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = CONNECT_TIMEOUT_MS
      readTimeout = READ_TIMEOUT_MS
      instanceFollowRedirects = true
    }
    try {
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
        throw IOException("The update server answered ${connection.responseCode}.")
      }
      connection.inputStream.use { input ->
        target.outputStream().use { output -> input.copyTo(output) }
      }
    } finally {
      connection.disconnect()
    }
    return target
  }

  companion object {
    const val NAME = "PixiUpdate"
    const val OPEN = "open"
    const val PERMISSION = "permission"
    const val APK_NAME = "pixi-update.apk"
    const val APK_MIME = "application/vnd.android.package.archive"
    const val CONNECT_TIMEOUT_MS = 15_000
    const val READ_TIMEOUT_MS = 120_000
  }
}

/** Exposes [PixiUpdateModule] (registered in MainApplication). */
class PixiUpdatePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(PixiUpdateModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
