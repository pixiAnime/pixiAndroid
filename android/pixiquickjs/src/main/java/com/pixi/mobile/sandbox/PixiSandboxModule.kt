package com.pixi.mobile.sandbox

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Kotlin shell around the native QuickJS extension sandbox.
 *
 * Contract with JavaScript (`src/platform/quickjs`):
 *  - every operation resolves its promise with a JSON **string** envelope
 *    `{ok:true,...}` / `{ok:false,err:{code,message}}`, so errors travel on
 *    the success path and are reconstructed by the TS facade;
 *  - `context.http` requests leave as the `PixiSandbox:hostRequest` event
 *    (the shared TS policy layer performs them) and return through
 *    `resolveHttp`;
 *  - `console` output from inside the sandbox arrives as `PixiSandbox:log`.
 *
 * The C++ side calls [onResult]/[onHostRequest]/[onLog] from its own worker
 * thread; those hop onto the React Native threads through [emit].
 */
class PixiSandboxModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  init {
    synchronized(LIB_LOCK) {
      if (!libraryLoaded) {
        System.loadLibrary(LIB_NAME)
        libraryLoaded = true
      }
    }
    instance = this
  }

  /** opId -> the promise waiting for that native operation. */
  private val pending = java.util.concurrent.ConcurrentHashMap<Long, Promise>()
  private val opSeq = java.util.concurrent.atomic.AtomicLong(1)

  override fun getName(): String = NAME

  override fun invalidate() {
    if (instance === this) instance = null
    pending.clear()
    super.invalidate()
  }

  /* ---------------------------------------------------------------- */
  /* JS -> native                                                       */
  /* ---------------------------------------------------------------- */

  @ReactMethod
  fun create(contextId: String, promise: Promise) = runNative(promise) { opId ->
    nativeCreate(opId, contextId)
  }

  @ReactMethod
  fun evaluate(
      contextId: String,
      runtimeJs: String,
      entryJs: String,
      moduleSource: String,
      promise: Promise,
  ) = runNative(promise) { opId ->
    nativeEvaluate(opId, contextId, runtimeJs, entryJs, moduleSource)
  }

  @ReactMethod
  fun call(
      contextId: String,
      method: String,
      argsJson: String,
      timeoutMs: Double,
      promise: Promise,
  ) = runNative(promise) { opId ->
    nativeCall(opId, contextId, method, argsJson, timeoutMs.toLong())
  }

  /** Response to a `PixiSandbox:hostRequest` event emitted by the sandbox. */
  @ReactMethod
  fun resolveHttp(contextId: String, requestId: Double, ok: Boolean, payloadJson: String) {
    try {
      nativeResolveHttp(contextId, requestId.toLong(), ok, payloadJson)
    } catch (t: Throwable) {
      Log.w(NAME, "resolveHttp failed", t)
    }
  }

  @ReactMethod
  fun dispose(contextId: String) {
    try {
      nativeDispose(contextId)
    } catch (t: Throwable) {
      Log.w(NAME, "dispose failed", t)
    }
  }

  /** Required by NativeEventEmitter; this module only uses DeviceEventEmitter. */
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  /* ---------------------------------------------------------------- */
  /* Native -> JS                                                       */
  /* ---------------------------------------------------------------- */

  private fun runNative(promise: Promise, block: (opId: Long) -> Unit) {
    val opId = opSeq.getAndIncrement()
    pending[opId] = promise
    try {
      block(opId)
    } catch (t: Throwable) {
      settle(opId, payloadJson = failureEnvelope(t.message ?: "The sandbox could not be started."))
    }
  }

  private fun settle(opId: Long, ok: Boolean = true, payloadJson: String) {
    val promise = pending.remove(opId) ?: return
    try {
      promise.resolve(payloadJson)
    } catch (t: Throwable) {
      Log.w(NAME, "could not settle sandbox operation $opId", t)
    }
  }

  /** Emit a bridge event, never throwing into the sandbox worker thread. */
  private fun emit(name: String, payload: () -> Any?) {
    val context = reactContext
    if (!context.hasActiveReactInstance()) return
    try {
      context.emitDeviceEvent(name, payload())
    } catch (t: Throwable) {
      Log.w(NAME, "dropped event $name", t)
    }
  }

  private fun emitHostRequest(contextId: String, requestId: Long, requestJson: String) {
    emit(EVENT_HOST_REQUEST) {
      Arguments.createMap().apply {
        putString("contextId", contextId)
        putDouble("requestId", requestId.toDouble())
        putString("json", requestJson)
      }
    }
  }

  private fun emitLog(contextId: String, level: String, message: String) {
    emit(EVENT_LOG) {
      Arguments.createMap().apply {
        putString("contextId", contextId)
        putString("level", level)
        putString("message", message)
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Native methods (registered from JNI_OnLoad)                       */
  /* ---------------------------------------------------------------- */

  external fun nativeCreate(opId: Long, contextId: String)

  external fun nativeEvaluate(
      opId: Long,
      contextId: String,
      runtimeJs: String,
      entryJs: String,
      moduleSource: String,
  )

  external fun nativeCall(
      opId: Long,
      contextId: String,
      method: String,
      argsJson: String,
      timeoutMs: Long,
  )

  external fun nativeResolveHttp(contextId: String, requestId: Long, ok: Boolean, payloadJson: String)

  external fun nativeDispose(contextId: String)

  companion object {
    const val NAME = "PixiSandbox"
    const val LIB_NAME = "pixiquickjs"
    const val EVENT_HOST_REQUEST = "PixiSandbox:hostRequest"
    const val EVENT_LOG = "PixiSandbox:log"

    private val LIB_LOCK = Any()
    @Volatile private var libraryLoaded = false

    @Volatile private var instance: PixiSandboxModule? = null

    /** Settle one pending operation. Called from the sandbox worker thread. */
    @JvmStatic
    fun onResult(opId: Long, contextId: String, ok: Boolean, payloadJson: String) {
      val module = instance
      if (module != null) {
        module.settle(opId, ok, payloadJson)
      } else if (ok) {
        Log.w(NAME, "no module instance to settle op $opId for $contextId")
      }
    }

    /** The sandbox wants an HTTP request. Called from the sandbox worker thread. */
    @JvmStatic
    fun onHostRequest(contextId: String, requestId: Long, requestJson: String) {
      instance?.emitHostRequest(contextId, requestId, requestJson)
    }

    /** `console.*` output from inside the sandbox. */
    @JvmStatic
    fun onLog(contextId: String, level: String, message: String) {
      Log.d("PixiSandbox", "[$contextId][$level] $message")
      instance?.emitLog(contextId, level, message)
    }
  }

  private fun failureEnvelope(message: String): String {
    val escaped = message
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    return "{\"ok\":false,\"err\":{\"code\":\"EXTENSION_ERROR\",\"message\":\"$escaped\"}}"
  }
}
