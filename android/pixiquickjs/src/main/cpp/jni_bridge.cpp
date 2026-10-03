/**
 * JNI bridge for the QuickJS extension sandbox (Android side).
 *
 * Registration is done from JNI_OnLoad via RegisterNatives; results travel
 * back to Kotlin through three static callbacks on PixiSandboxModule. All
 * up-calls originate on the sandbox worker thread — the Kotlin side is
 * responsible for hopping onto the React Native threads.
 *
 * String conversion is done by hand (UTF-8 <-> UTF-16) instead of
 * GetStringUTFChars/NewStringUTF: JNI's "modified UTF-8" would corrupt
 * emoji in extension sources and non-ASCII error messages.
 */

#include <jni.h>
#include <android/log.h>

#include <cstdint>
#include <string>
#include <vector>

#include "pixi_host.h"
#include "pixi_sandbox.h"

#define LOG_TAG "PixiSandbox"
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

JavaVM* g_vm = nullptr;
jclass g_module_class = nullptr;
jmethodID g_on_result = nullptr;
jmethodID g_on_host_request = nullptr;
jmethodID g_on_log = nullptr;
bool g_ready = false;

constexpr const char* kModuleClass = "com/pixi/mobile/sandbox/PixiSandboxModule";

JNIEnv* currentEnv() {
  if (!g_vm) return nullptr;
  JNIEnv* env = nullptr;
  if (g_vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK) return env;
  if (g_vm->AttachCurrentThread(&env, nullptr) == JNI_OK) return env;
  return nullptr;
}

void clearException(JNIEnv* env, const char* where) {
  if (!env->ExceptionCheck()) return;
  LOGE("pending JNI exception in %s", where);
  env->ExceptionDescribe();
  env->ExceptionClear();
}

/* ------------------------------------------------------------------ */
/* UTF-8 <-> UTF-16 (never uses JNI's modified UTF-8 shortcuts)        */
/* ------------------------------------------------------------------ */

std::string jstringToUtf8(JNIEnv* env, jstring value) {
  if (!value) return {};
  jsize length = env->GetStringLength(value);
  const jchar* chars = env->GetStringChars(value, nullptr);
  if (!chars) return {};

  std::string out;
  out.reserve(static_cast<size_t>(length));
  for (jsize i = 0; i < length; i++) {
    uint32_t cp = chars[i];
    if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < length && chars[i + 1] >= 0xDC00 &&
        chars[i + 1] <= 0xDFFF) {
      cp = 0x10000u + ((cp - 0xD800u) << 10) + (static_cast<uint32_t>(chars[i + 1]) - 0xDC00u);
      i++;
    } else if (cp >= 0xD800 && cp <= 0xDFFF) {
      cp = 0xFFFD;  // lone surrogate
    }

    if (cp < 0x80) {
      out += static_cast<char>(cp);
    } else if (cp < 0x800) {
      out += static_cast<char>(0xC0 | (cp >> 6));
      out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
      out += static_cast<char>(0xE0 | (cp >> 12));
      out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
      out += static_cast<char>(0x80 | (cp & 0x3F));
    } else {
      out += static_cast<char>(0xF0 | (cp >> 18));
      out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
      out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
      out += static_cast<char>(0x80 | (cp & 0x3F));
    }
  }
  env->ReleaseStringChars(value, chars);
  return out;
}

jstring utf8ToJString(JNIEnv* env, const std::string& value) {
  static const jchar kEmpty[1] = {0};
  std::vector<jchar> out;
  out.reserve(value.size());

  size_t i = 0;
  const size_t n = value.size();
  while (i < n) {
    const auto c = static_cast<unsigned char>(value[i]);
    uint32_t cp = 0xFFFD;
    size_t extra = 0;
    bool valid = true;

    if (c < 0x80) {
      cp = c;
      extra = 0;
    } else if ((c & 0xE0) == 0xC0) {
      cp = c & 0x1F;
      extra = 1;
    } else if ((c & 0xF0) == 0xE0) {
      cp = c & 0x0F;
      extra = 2;
    } else if ((c & 0xF8) == 0xF0) {
      cp = c & 0x07;
      extra = 3;
    } else {
      i++;
      out.push_back(0xFFFD);
      continue;
    }

    if (extra > 0 && i + extra >= n) {
      i = n;
      out.push_back(0xFFFD);
      break;
    }
    for (size_t k = 1; k <= extra; k++) {
      const auto cc = static_cast<unsigned char>(value[i + k]);
      if ((cc & 0xC0) != 0x80) {
        valid = false;
        break;
      }
      cp = (cp << 6) | (cc & 0x3F);
    }
    if (valid && ((extra == 1 && cp < 0x80) || (extra == 2 && cp < 0x800) ||
                  (extra == 3 && cp < 0x10000) || cp > 0x10FFFF ||
                  (cp >= 0xD800 && cp <= 0xDFFF))) {
      valid = false;
    }
    if (!valid) {
      i++;
      out.push_back(0xFFFD);
      continue;
    }

    i += extra + 1;
    if (cp < 0x10000) {
      out.push_back(static_cast<jchar>(cp));
    } else {
      cp -= 0x10000;
      out.push_back(static_cast<jchar>(0xD800 + (cp >> 10)));
      out.push_back(static_cast<jchar>(0xDC00 + (cp & 0x3FF)));
    }
  }

  return env->NewString(out.empty() ? kEmpty : out.data(), static_cast<jsize>(out.size()));
}

/* ------------------------------------------------------------------ */
/* Native methods (Kotlin -> C++)                                      */
/* ------------------------------------------------------------------ */

void nativeCreate(JNIEnv* env, jclass, jlong opId, jstring contextId) {
  pixi::create(static_cast<int64_t>(opId), jstringToUtf8(env, contextId));
}

void nativeEvaluate(JNIEnv* env, jclass, jlong opId, jstring contextId, jstring runtimeJs,
                    jstring entryJs, jstring moduleSource) {
  pixi::evaluate(static_cast<int64_t>(opId), jstringToUtf8(env, contextId),
                 jstringToUtf8(env, runtimeJs), jstringToUtf8(env, entryJs),
                 jstringToUtf8(env, moduleSource));
}

void nativeCall(JNIEnv* env, jclass, jlong opId, jstring contextId, jstring method,
                jstring argsJson, jlong timeoutMs) {
  pixi::call(static_cast<int64_t>(opId), jstringToUtf8(env, contextId), jstringToUtf8(env, method),
             jstringToUtf8(env, argsJson), static_cast<int64_t>(timeoutMs));
}

void nativeResolveHttp(JNIEnv* env, jclass, jstring contextId, jlong requestId, jboolean ok,
                       jstring payloadJson) {
  pixi::resolveHttp(jstringToUtf8(env, contextId), static_cast<int64_t>(requestId),
                    ok == JNI_TRUE, jstringToUtf8(env, payloadJson));
}

void nativeDispose(JNIEnv* env, jclass, jstring contextId) {
  pixi::dispose(jstringToUtf8(env, contextId));
}

const JNINativeMethod kNativeMethods[] = {
    {"nativeCreate", "(JLjava/lang/String;)V", reinterpret_cast<void*>(nativeCreate)},
    {"nativeEvaluate", "(JLjava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V",
     reinterpret_cast<void*>(nativeEvaluate)},
    {"nativeCall", "(JLjava/lang/String;Ljava/lang/String;Ljava/lang/String;J)V",
     reinterpret_cast<void*>(nativeCall)},
    {"nativeResolveHttp", "(Ljava/lang/String;JZLjava/lang/String;)V",
     reinterpret_cast<void*>(nativeResolveHttp)},
    {"nativeDispose", "(Ljava/lang/String;)V", reinterpret_cast<void*>(nativeDispose)},
};

}  // namespace

/* ------------------------------------------------------------------ */
/* Up-calls (C++ -> Kotlin), implemented against pixi_host.h           */
/* ------------------------------------------------------------------ */

namespace pixi {
namespace host {

void result(int64_t opId, const std::string& contextId, bool ok, const std::string& payloadJson) {
  if (!g_ready) return;
  JNIEnv* env = currentEnv();
  if (!env) return;
  jstring jContextId = utf8ToJString(env, contextId);
  jstring jPayload = utf8ToJString(env, payloadJson);
  env->CallStaticVoidMethod(g_module_class, g_on_result, static_cast<jlong>(opId), jContextId,
                            ok ? JNI_TRUE : JNI_FALSE, jPayload);
  env->DeleteLocalRef(jContextId);
  env->DeleteLocalRef(jPayload);
  clearException(env, "onResult");
}

void hostRequest(const std::string& contextId, int64_t requestId, const std::string& requestJson) {
  if (!g_ready) return;
  JNIEnv* env = currentEnv();
  if (!env) return;
  jstring jContextId = utf8ToJString(env, contextId);
  jstring jJson = utf8ToJString(env, requestJson);
  env->CallStaticVoidMethod(g_module_class, g_on_host_request, jContextId,
                            static_cast<jlong>(requestId), jJson);
  env->DeleteLocalRef(jContextId);
  env->DeleteLocalRef(jJson);
  clearException(env, "onHostRequest");
}

void log(const std::string& contextId, const char* level, const std::string& message) {
  if (!g_ready) return;
  JNIEnv* env = currentEnv();
  if (!env) return;
  jstring jContextId = utf8ToJString(env, contextId);
  jstring jLevel = utf8ToJString(env, level ? level : "log");
  jstring jMessage = utf8ToJString(env, message);
  env->CallStaticVoidMethod(g_module_class, g_on_log, jContextId, jLevel, jMessage);
  env->DeleteLocalRef(jContextId);
  env->DeleteLocalRef(jLevel);
  env->DeleteLocalRef(jMessage);
  clearException(env, "onLog");
}

}  // namespace host
}  // namespace pixi

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

extern "C" JNIEXPORT jint JNI_OnLoad(JavaVM* vm, void*) {
  g_vm = vm;
  JNIEnv* env = nullptr;
  if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) != JNI_OK) {
    LOGE("JNI_OnLoad: GetEnv failed");
    return JNI_ERR;
  }

  jclass local = env->FindClass(kModuleClass);
  if (local == nullptr) {
    LOGE("JNI_OnLoad: %s not found", kModuleClass);
    env->ExceptionClear();
    return JNI_ERR;
  }
  g_module_class = static_cast<jclass>(env->NewGlobalRef(local));
  env->DeleteLocalRef(local);

  g_on_result = env->GetStaticMethodID(g_module_class, "onResult",
                                       "(JLjava/lang/String;ZLjava/lang/String;)V");
  g_on_host_request = env->GetStaticMethodID(g_module_class, "onHostRequest",
                                             "(Ljava/lang/String;JLjava/lang/String;)V");
  g_on_log = env->GetStaticMethodID(g_module_class, "onLog",
                                    "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V");
  if (g_on_result == nullptr || g_on_host_request == nullptr || g_on_log == nullptr) {
    LOGE("JNI_OnLoad: static callbacks not found");
    env->ExceptionClear();
    return JNI_ERR;
  }

  if (env->RegisterNatives(g_module_class, kNativeMethods,
                           sizeof(kNativeMethods) / sizeof(kNativeMethods[0])) != 0) {
    LOGE("JNI_OnLoad: RegisterNatives failed");
    env->ExceptionClear();
    return JNI_ERR;
  }

  g_ready = true;
  return JNI_VERSION_1_6;
}
