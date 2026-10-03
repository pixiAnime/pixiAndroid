/**
 * pixi_sandbox — QuickJS extension runtime for Pixi Mobile.
 *
 * One JSRuntime per extension, all evaluation happens on a dedicated worker
 * thread so a wedged extension can never stall the React Native JS thread.
 * Deadlines are enforced twice:
 *   - engine-side: JS_SetInterruptHandler aborts runaway bytecode in place
 *     (an `while (true)` inside an extension is cut at the deadline), and
 *   - host-side: the worker wakes at each call's deadline and fails it.
 *
 * A timed-out or interrupted context is disposed; the next call boots a fresh
 * one — the exact recycle rule of the web's iframe sandbox.
 *
 * Platform-neutral: the Android JNI bridge (and a future iOS bridge) sit on
 * top of pixi_host.h / this file. No React Native types are touched here.
 */

#include "pixi_sandbox.h"

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

#include "../quickjs/quickjs.h"
#include "pixi_host.h"

namespace pixi {
namespace {

using Clock = std::chrono::steady_clock;
using Ms = std::chrono::milliseconds;

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/** Hard cap on one extension's heap (V8-equivalent "MaxOldGenerationSize"). */
constexpr size_t kMemoryLimitBytes = 192u * 1024 * 1024;
/** QuickJS C stack (must stay well below the OS thread stack). */
constexpr size_t kStackLimitBytes = 512u * 1024;
/** Sandbox boot deadline (evaluate runtime + entry module + read manifest). */
constexpr int64_t kBootTimeoutMs = 10'000;
/** Safety cap for bytecode executed when no call/deadline is active. */
constexpr int64_t kIdleDeadlineMs = 5'000;
/** Specifier served by our module loader — the extension source. */
constexpr const char* kExtModule = "pixi:extension";

/* ------------------------------------------------------------------ */
/* Shared state (guarded by g_mutex)                                   */
/* ------------------------------------------------------------------ */

std::mutex g_mutex;
std::condition_variable g_cv;
std::deque<std::function<void()>> g_queue;
std::unordered_map<std::string, std::shared_ptr<struct Context>> g_contexts;
bool g_worker_started = false;
std::thread g_worker;

void post(std::function<void()> fn) {
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_queue.push_back(std::move(fn));
  }
  g_cv.notify_one();
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

struct ActiveCall {
  int64_t opId = 0;
  Clock::time_point deadline;
  std::string method;
};

struct Timer {
  int64_t id = 0;
  Clock::time_point due;
  int64_t intervalMs = 0;  // 0 = one-shot
  JSValue fn = JS_UNDEFINED;
};

struct Context {
  std::string id;
  std::string moduleSource;

  // Contexts are only mutated from the worker thread.
  JSRuntime* rt = nullptr;
  JSContext* ctx = nullptr;
  bool disposed = false;

  bool booting = false;
  int64_t bootOpId = 0;
  Clock::time_point bootDeadline = Clock::time_point::max();

  std::map<int64_t, ActiveCall> calls;
  std::map<int64_t, Timer> timers;
  int64_t nextTimerId = 1;

  Clock::time_point interruptDeadline = Clock::time_point::max();
  bool interrupted = false;

  ~Context() {
    // Normally released by doRelease() on the worker thread; the null checks
    // make a late release on another thread a leak instead of a data race.
    if (ctx) {
      JS_FreeContext(ctx);
      ctx = nullptr;
    }
    if (rt) {
      JS_FreeRuntime(rt);
      rt = nullptr;
    }
  }
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

std::string jsonEscape(const std::string& in) {
  std::string out;
  out.reserve(in.size() + 8);
  for (unsigned char ch : in) {
    switch (ch) {
      case '"':
        out += "\\\"";
        break;
      case '\\':
        out += "\\\\";
        break;
      case '\b':
        out += "\\b";
        break;
      case '\f':
        out += "\\f";
        break;
      case '\n':
        out += "\\n";
        break;
      case '\r':
        out += "\\r";
        break;
      case '\t':
        out += "\\t";
        break;
      default:
        if (ch < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof(buf), "\\u%04x", ch);
          out += buf;
        } else {
          out += static_cast<char>(ch);
        }
    }
  }
  return out;
}

/** `{"ok":false,"err":{...}}` — the single envelope shape consumed by TS. */
std::string errorEnvelope(const char* code, const std::string& message) {
  return std::string("{\"ok\":false,\"err\":{\"code\":\"") + code +
         "\",\"message\":\"" + jsonEscape(message) + "\"}}";
}

std::string okEnvelope() { return "{\"ok\":true}"; }

std::string toStdString(JSContext* ctx, JSValueConst v) {
  const char* s = JS_ToCString(ctx, v);
  if (!s) return std::string();
  std::string out(s);
  JS_FreeCString(ctx, s);
  return out;
}

/** Consume and report the pending exception (never leaves one behind). */
std::string takeException(JSContext* ctx) {
  JSValue exc = JS_GetException(ctx);
  JSValue str = JS_ToString(ctx, exc);
  std::string message;
  if (JS_IsException(str)) {
    // toString() itself threw — drop the secondary exception too.
    JS_FreeValue(ctx, JS_GetException(ctx));
    message = "Unknown error.";
  } else {
    message = toStdString(ctx, str);
    JS_FreeValue(ctx, str);
  }
  JS_FreeValue(ctx, exc);
  return message;
}

void reportException(Context* c, JSContext* ctx) {
  std::string message = takeException(ctx);
  host::log(c->id, "error", message);
}

JSValue getGlobalFn(Context* c, const char* name) {
  JSValue global = JS_GetGlobalObject(c->ctx);
  JSValue fn = JS_GetPropertyStr(c->ctx, global, name);
  JS_FreeValue(c->ctx, global);
  return fn;
}

/** Defined below; declared here because pump() recycles contexts. */
void releaseContext(Context* c, const char* code, const char* message);

/** Refresh the deadline the interrupt handler enforces. */
void updateDeadline(Context* c, int64_t idleCapMs) {
  Clock::time_point dl = Clock::time_point::max();
  if (c->booting) dl = std::min(dl, c->bootDeadline);
  for (const auto& kv : c->calls) dl = std::min(dl, kv.second.deadline);
  if (dl == Clock::time_point::max()) dl = Clock::now() + Ms(idleCapMs);
  c->interruptDeadline = dl;
  c->interrupted = false;
}

int onInterrupt(JSRuntime* /*rt*/, void* opaque) {
  auto* c = static_cast<Context*>(opaque);
  if (Clock::now() >= c->interruptDeadline) {
    c->interrupted = true;
    return 1;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* QuickJS host functions (callable from sandbox code)                 */
/* ------------------------------------------------------------------ */

/** `__pixiHostRequest(requestId, requestJson)` → routed to the TS policy layer. */
JSValue jsHostRequest(JSContext* ctx, JSValueConst /*thisVal*/, int argc, JSValueConst* argv) {
  auto* c = static_cast<Context*>(JS_GetContextOpaque(ctx));
  if (!c) return JS_ThrowInternalError(ctx, "sandbox not initialised");
  if (argc < 2) return JS_ThrowTypeError(ctx, "__pixiHostRequest(id, json)");
  int64_t requestId = 0;
  if (JS_ToInt64(ctx, &requestId, argv[0]) < 0) return JS_EXCEPTION;
  std::string json = toStdString(ctx, argv[1]);
  host::hostRequest(c->id, requestId, json);
  return JS_UNDEFINED;
}

/** `__pixiHostLog(level, message)` */
JSValue jsHostLog(JSContext* ctx, JSValueConst /*thisVal*/, int argc, JSValueConst* argv) {
  auto* c = static_cast<Context*>(JS_GetContextOpaque(ctx));
  if (!c || argc < 2) return JS_UNDEFINED;
  std::string level = toStdString(ctx, argv[0]);
  std::string message = toStdString(ctx, argv[1]);
  host::log(c->id, level.c_str(), message);
  return JS_UNDEFINED;
}

/** `__pixiSetTimeout(fn, ms)` / `__pixiSetInterval(fn, ms)` → timer id. */
JSValue jsSetTimer(JSContext* ctx, JSValueConst /*thisVal*/, int argc, JSValueConst* argv,
                   int64_t intervalMs) {
  auto* c = static_cast<Context*>(JS_GetContextOpaque(ctx));
  if (!c) return JS_ThrowInternalError(ctx, "sandbox not initialised");
  if (argc < 1 || !JS_IsFunction(ctx, argv[0])) return JS_ThrowTypeError(ctx, "timer callback must be a function");
  int64_t delay = 0;
  if (argc >= 2 && JS_ToInt64(ctx, &delay, argv[1]) < 0) return JS_EXCEPTION;
  if (delay < 0) delay = 0;
  if (delay > 600'000) delay = 600'000;

  Timer t;
  t.id = c->nextTimerId++;
  t.intervalMs = intervalMs;
  t.due = Clock::now() + Ms(delay);
  t.fn = JS_DupValue(ctx, argv[0]);
  int64_t id = t.id;
  c->timers[id] = t;
  return JS_NewInt64(ctx, id);
}

JSValue jsSetTimeout(JSContext* ctx, JSValueConst thisVal, int argc, JSValueConst* argv) {
  return jsSetTimer(ctx, thisVal, argc, argv, 0);
}

JSValue jsSetInterval(JSContext* ctx, JSValueConst thisVal, int argc, JSValueConst* argv) {
  return jsSetTimer(ctx, thisVal, argc, argv, 1);
}

/** `__pixiClearTimer(id)` — covers both clearTimeout and clearInterval. */
JSValue jsClearTimer(JSContext* ctx, JSValueConst /*thisVal*/, int argc, JSValueConst* argv) {
  auto* c = static_cast<Context*>(JS_GetContextOpaque(ctx));
  if (!c || argc < 1) return JS_UNDEFINED;
  int64_t id = 0;
  if (JS_ToInt64(ctx, &id, argv[0]) < 0) return JS_EXCEPTION;
  auto it = c->timers.find(id);
  if (it != c->timers.end()) {
    JS_FreeValue(ctx, it->second.fn);
    c->timers.erase(it);
  }
  return JS_UNDEFINED;
}

void defineHostFunction(JSContext* ctx, const char* name, JSCFunction* fn, int length) {
  JSValue global = JS_GetGlobalObject(ctx);
  JSValue func = JS_NewCFunction(ctx, fn, name, length);
  JS_SetPropertyStr(ctx, global, name, func);  // consumes func
  JS_FreeValue(ctx, global);
}

/* ------------------------------------------------------------------ */
/* Module loader                                                       */
/* ------------------------------------------------------------------ */

JSModuleDef* moduleLoader(JSContext* ctx, const char* module_name, void* opaque) {
  auto* c = static_cast<Context*>(opaque);
  if (!c || std::strcmp(module_name, kExtModule) != 0) {
    JS_ThrowReferenceError(ctx, "import of '%s' is not allowed by the sandbox", module_name);
    return nullptr;
  }
  // Compile-only evaluation of a module returns the JSModuleDef as a function
  // value; quickjs keeps the definition in the context's module list.
  JSValue fn = JS_Eval(ctx, c->moduleSource.data(), c->moduleSource.size(), module_name,
                       JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
  if (JS_IsException(fn)) return nullptr;
  auto* def = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(fn));
  JS_FreeValue(ctx, fn);
  return def;
}

/* ------------------------------------------------------------------ */
/* Runtime construction                                                */
/* ------------------------------------------------------------------ */

void ensureRuntime(Context* c) {
  if (c->rt) return;
  c->rt = JS_NewRuntime();
  if (!c->rt) return;
  JS_SetMemoryLimit(c->rt, kMemoryLimitBytes);
  JS_SetMaxStackSize(c->rt, kStackLimitBytes);
  JS_SetInterruptHandler(c->rt, onInterrupt, c);
  JS_SetModuleLoaderFunc(c->rt, nullptr, moduleLoader, c);

  c->ctx = JS_NewContext(c->rt);
  if (!c->ctx) {
    JS_FreeRuntime(c->rt);
    c->rt = nullptr;
    return;
  }
  JS_SetContextOpaque(c->ctx, c);

  defineHostFunction(c->ctx, "__pixiHostRequest", jsHostRequest, 2);
  defineHostFunction(c->ctx, "__pixiHostLog", jsHostLog, 2);
  defineHostFunction(c->ctx, "__pixiSetTimeout", jsSetTimeout, 2);
  defineHostFunction(c->ctx, "__pixiSetInterval", jsSetInterval, 2);
  defineHostFunction(c->ctx, "__pixiClearTimer", jsClearTimer, 1);

  // The extension id reaches every error message the sandbox produces.
  JSValue global = JS_GetGlobalObject(c->ctx);
  JS_SetPropertyStr(c->ctx, global, "__pixiExtId", JS_NewString(c->ctx, c->id.c_str()));
  JS_FreeValue(c->ctx, global);
}

/* ------------------------------------------------------------------ */
/* Outcomes / deadlines                                                */
/* ------------------------------------------------------------------ */

/** Collect finished calls (`__pixiTakeOutcome` deletes as it reads). */
void settleOutcomes(Context* c) {
  if (c->calls.empty()) return;
  JSValue fn = getGlobalFn(c, "__pixiTakeOutcome");
  if (!JS_IsFunction(c->ctx, fn)) {
    JS_FreeValue(c->ctx, fn);
    return;
  }
  for (auto it = c->calls.begin(); it != c->calls.end();) {
    JSValue arg = JS_NewInt64(c->ctx, it->first);
    JSValue ret = JS_Call(c->ctx, fn, JS_UNDEFINED, 1, &arg);
    JS_FreeValue(c->ctx, arg);
    if (JS_IsException(ret)) {
      reportException(c, c->ctx);
      ++it;
      continue;
    }
    if (JS_IsUndefined(ret) || JS_IsNull(ret)) {
      JS_FreeValue(c->ctx, ret);
      ++it;
      continue;
    }
    std::string json = toStdString(c->ctx, ret);
    JS_FreeValue(c->ctx, ret);
    if (json.empty() || json[0] != '{') {
      // The bootstrap always stringifies an object; anything else is corrupt.
      json = errorEnvelope("INVALID_RESULT", "The extension returned data that cannot be used.");
    }
    int64_t opId = it->first;
    it = c->calls.erase(it);
    host::result(opId, c->id, true, json);
  }
  JS_FreeValue(c->ctx, fn);
}

/**
 * Run pending microtasks, settle finished work, then enforce deadlines.
 * Returns true when the context was disposed as a result.
 */
bool pump(Context* c) {
  if (!c || c->disposed || !c->ctx) return false;

  updateDeadline(c, kIdleDeadlineMs);
  bool interrupted = false;
  for (;;) {
    JSContext* jobCtx = nullptr;
    int r = JS_ExecutePendingJob(c->rt, &jobCtx);
    if (r == 0) break;
    if (r < 0 && jobCtx) reportException(c, jobCtx);
    if (c->interrupted) {
      interrupted = true;
      break;
    }
    updateDeadline(c, kIdleDeadlineMs);
  }

  if (!interrupted) settleOutcomes(c);

  // Deadline bookkeeping — one interrupted run means the whole context is
  // suspect, so recycle it exactly like the web does with its iframe.
  auto now = Clock::now();
  bool recycle = interrupted;
  if (c->booting && (interrupted || now >= c->bootDeadline)) {
    int64_t opId = c->bootOpId;
    c->bootOpId = 0;
    c->booting = false;
    if (opId) host::result(opId, c->id, false, errorEnvelope("EXTENSION_TIMEOUT", "The extension took too long to load."));
    recycle = true;
  }
  for (auto it = c->calls.begin(); it != c->calls.end();) {
    if (interrupted || now >= it->second.deadline) {
      int64_t opId = it->first;
      it = c->calls.erase(it);
      host::result(opId, c->id, false, errorEnvelope("EXTENSION_TIMEOUT", "The extension took too long to respond."));
      recycle = true;
    } else {
      ++it;
    }
  }
  if (recycle) {
    releaseContext(c, "EXTENSION_NOT_FOUND", "The extension was reloaded after a timeout.");
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Operations (all executed on the worker thread)                      */
/* ------------------------------------------------------------------ */

void releaseContext(Context* c, const char* code, const char* message) {
  if (c->disposed) return;
  c->disposed = true;

  // In-flight work can never finish now — fail it the way the web sandbox does.
  if (c->booting && c->bootOpId) {
    int64_t opId = c->bootOpId;
    c->bootOpId = 0;
    c->booting = false;
    host::result(opId, c->id, false, errorEnvelope(code, message));
  }
  for (auto& kv : c->calls) host::result(kv.first, c->id, false, errorEnvelope(code, message));
  c->calls.clear();

  if (c->ctx) {
    for (auto& kv : c->timers) JS_FreeValue(c->ctx, kv.second.fn);
    c->timers.clear();
    JS_FreeContext(c->ctx);
    c->ctx = nullptr;
  }
  if (c->rt) {
    JS_FreeRuntime(c->rt);
    c->rt = nullptr;
  }

  std::lock_guard<std::mutex> lock(g_mutex);
  auto it = g_contexts.find(c->id);
  if (it != g_contexts.end() && it->second.get() == c) g_contexts.erase(it);
}

void doEvaluate(std::shared_ptr<Context> sp, int64_t opId, std::string runtimeJs,
                std::string entryJs, std::string moduleSource) {
  Context* c = sp.get();
  if (c->disposed) {
    host::result(opId, c->id, false, errorEnvelope("EXTENSION_NOT_FOUND", "The extension is no longer available."));
    return;
  }
  ensureRuntime(c);
  if (!c->ctx) {
    host::result(opId, c->id, false, errorEnvelope("EXTENSION_ERROR", "The sandbox could not be started."));
    return;
  }

  c->moduleSource = std::move(moduleSource);
  c->booting = true;
  c->bootOpId = opId;
  c->bootDeadline = Clock::now() + Ms(kBootTimeoutMs);
  updateDeadline(c, kBootTimeoutMs);

  JSValue ret = JS_Eval(c->ctx, runtimeJs.data(), runtimeJs.size(), "pixi-bootstrap.js",
                        JS_EVAL_TYPE_GLOBAL);
  if (JS_IsException(ret)) {
    std::string message = takeException(c->ctx);
    c->booting = false;
    c->bootOpId = 0;
    host::result(opId, c->id, false,
                 errorEnvelope("VALIDATION_FAILED", "The extension could not be loaded: " + message));
    releaseContext(c, "EXTENSION_NOT_FOUND", "The extension could not be loaded.");
    return;
  }
  JS_FreeValue(c->ctx, ret);

  updateDeadline(c, kBootTimeoutMs);
  ret = JS_Eval(c->ctx, entryJs.data(), entryJs.size(), "pixi-entry.js", JS_EVAL_TYPE_MODULE);
  if (JS_IsException(ret)) {
    std::string message = takeException(c->ctx);
    c->booting = false;
    c->bootOpId = 0;
    host::result(opId, c->id, false,
                 errorEnvelope("VALIDATION_FAILED",
                               "The extension module could not be evaluated: " + message));
    releaseContext(c, "EXTENSION_NOT_FOUND", "The extension could not be loaded.");
    return;
  }
  JS_FreeValue(c->ctx, ret);

  if (pump(c)) return;  // recycled while booting (interrupted / timed out)

  JSValue fn = getGlobalFn(c, "__pixiTakeBoot");
  JSValue boot = JS_IsFunction(c->ctx, fn) ? JS_Call(c->ctx, fn, JS_UNDEFINED, 0, nullptr) : JS_UNDEFINED;
  JS_FreeValue(c->ctx, fn);

  bool ok = false;
  std::string json;
  if (JS_IsException(boot)) {
    json = errorEnvelope("VALIDATION_FAILED", "The extension could not be loaded: " + takeException(c->ctx));
  } else if (JS_IsUndefined(boot)) {
    json = errorEnvelope("VALIDATION_FAILED", "The extension did not report a manifest.");
  } else {
    json = toStdString(c->ctx, boot);
    ok = true;
  }
  JS_FreeValue(c->ctx, boot);

  c->booting = false;
  c->bootOpId = 0;
  host::result(opId, c->id, ok, json);
}

void doCall(std::shared_ptr<Context> sp, int64_t opId, std::string method, std::string argsJson,
            int64_t timeoutMs) {
  Context* c = sp.get();
  if (c->disposed || !c->ctx) {
    host::result(opId, c->id, false, errorEnvelope("EXTENSION_NOT_FOUND", "The extension is no longer available."));
    return;
  }
  if (timeoutMs <= 0) timeoutMs = 20'000;

  c->calls[opId] = ActiveCall{opId, Clock::now() + Ms(timeoutMs), method};
  updateDeadline(c, kIdleDeadlineMs);

  JSValue fn = getGlobalFn(c, "__pixiCall");
  if (!JS_IsFunction(c->ctx, fn)) {
    JS_FreeValue(c->ctx, fn);
    c->calls.erase(opId);
    host::result(opId, c->id, false, errorEnvelope("EXTENSION_NOT_FOUND", "The extension is not loaded."));
    return;
  }
  JSValue argv[3];
  argv[0] = JS_NewInt64(c->ctx, opId);
  argv[1] = JS_NewString(c->ctx, method.c_str());
  argv[2] = JS_NewString(c->ctx, argsJson.c_str());
  JSValue ret = JS_Call(c->ctx, fn, JS_UNDEFINED, 3, argv);
  JS_FreeValue(c->ctx, argv[0]);
  JS_FreeValue(c->ctx, argv[1]);
  JS_FreeValue(c->ctx, argv[2]);
  JS_FreeValue(c->ctx, fn);

  if (JS_IsException(ret)) {
    std::string message = takeException(c->ctx);
    c->calls.erase(opId);
    host::result(opId, c->id, false, errorEnvelope("EXTENSION_ERROR", message));
    return;
  }
  JS_FreeValue(c->ctx, ret);
  pump(c);
}

void doResolveHttp(std::shared_ptr<Context> sp, int64_t requestId, bool ok, std::string payload) {
  Context* c = sp.get();
  if (c->disposed || !c->ctx) return;
  updateDeadline(c, kIdleDeadlineMs);

  JSValue fn = getGlobalFn(c, "__pixiHttpResult");
  if (!JS_IsFunction(c->ctx, fn)) {
    JS_FreeValue(c->ctx, fn);
    return;
  }
  JSValue argv[3];
  argv[0] = JS_NewInt64(c->ctx, requestId);
  argv[1] = JS_NewBool(c->ctx, ok);
  argv[2] = JS_NewString(c->ctx, payload.c_str());
  JSValue ret = JS_Call(c->ctx, fn, JS_UNDEFINED, 3, argv);
  JS_FreeValue(c->ctx, argv[0]);
  JS_FreeValue(c->ctx, argv[1]);
  JS_FreeValue(c->ctx, argv[2]);
  JS_FreeValue(c->ctx, fn);
  if (JS_IsException(ret)) {
    reportException(c, c->ctx);
    return;
  }
  JS_FreeValue(c->ctx, ret);
  pump(c);
}

/** Fire every timer that is due. Returns true if the context was recycled. */
bool fireDueTimers(Context* c) {
  if (c->disposed || !c->ctx || c->timers.empty()) return false;
  auto now = Clock::now();
  std::vector<int64_t> due;
  for (const auto& kv : c->timers) {
    if (kv.second.due <= now) due.push_back(kv.first);
  }
  if (due.empty()) return false;

  for (int64_t id : due) {
    auto it = c->timers.find(id);
    if (it == c->timers.end()) continue;
    Timer timer = it->second;  // shallow copy: we still own the single ref
    bool repeat = timer.intervalMs > 0;
    if (repeat) {
      it->second.due = Clock::now() + Ms(timer.intervalMs);
    } else {
      c->timers.erase(it);
    }

    // Timer callbacks are bounded too: a `while (true)` inside a tick must not
    // own the worker thread forever.
    updateDeadline(c, kIdleDeadlineMs);
    JSValue ret = JS_Call(c->ctx, timer.fn, JS_UNDEFINED, 0, nullptr);
    if (JS_IsException(ret)) {
      reportException(c, c->ctx);
    } else {
      JS_FreeValue(c->ctx, ret);
    }
    if (!repeat) JS_FreeValue(c->ctx, timer.fn);

    if (c->interrupted) {
      host::log(c->id, "error", "A timer callback exceeded its deadline; the extension was reloaded.");
      releaseContext(c, "EXTENSION_NOT_FOUND", "The extension was reloaded after a timeout.");
      return true;
    }
    if (pump(c)) return true;
  }
  return false;
}

/** Worker wake: fire due timers, then expire anything that ran out of time. */
void tick() {
  std::vector<std::shared_ptr<Context>> snapshot;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    snapshot.reserve(g_contexts.size());
    for (auto& kv : g_contexts) snapshot.push_back(kv.second);
  }
  for (auto& sp : snapshot) {
    if (sp->disposed) continue;
    fireDueTimers(sp.get());
  }
  for (auto& sp : snapshot) {
    if (sp->disposed) continue;
    bool expired = sp->booting && Clock::now() >= sp->bootDeadline;
    for (const auto& kv : sp->calls) {
      if (Clock::now() >= kv.second.deadline) {
        expired = true;
        break;
      }
    }
    if (expired) pump(sp.get());
  }
}

/** Earliest wake-up across every live context (timers + deadlines). */
Clock::time_point nextWakeLocked() {
  Clock::time_point wake = Clock::time_point::max();
  for (const auto& kv : g_contexts) {
    const Context* c = kv.second.get();
    if (c->disposed) continue;
    if (c->booting) wake = std::min(wake, c->bootDeadline);
    for (const auto& call : c->calls) wake = std::min(wake, call.second.deadline);
    for (const auto& timer : c->timers) wake = std::min(wake, timer.second.due);
  }
  return wake;
}

void workerLoop() {
  for (;;) {
    std::function<void()> task;
    bool haveTask = false;
    bool timedOut = false;
    {
      std::unique_lock<std::mutex> lock(g_mutex);
      if (!g_queue.empty()) {
        task = std::move(g_queue.front());
        g_queue.pop_front();
        haveTask = true;
      } else {
        Clock::time_point wake = nextWakeLocked();
        if (wake == Clock::time_point::max()) {
          g_cv.wait(lock);
        } else {
          timedOut = g_cv.wait_until(lock, wake) == std::cv_status::timeout;
        }
      }
    }
    if (haveTask) {
      task();
    } else if (timedOut) {
      tick();
    }
  }
}

void ensureWorker() {
  if (g_worker_started) return;
  g_worker_started = true;
  g_worker = std::thread(workerLoop);
  g_worker.detach();
}

}  // namespace

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

void create(int64_t opId, const std::string& contextId) {
  auto sp = std::make_shared<Context>();
  sp->id = contextId;
  std::shared_ptr<Context> previous;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_contexts.find(contextId);
    if (it != g_contexts.end()) previous = it->second;
    g_contexts[contextId] = sp;
    ensureWorker();
  }
  if (previous) {
    // Recreating an id we already own: retire the old runtime first.
    post([previous] {
      releaseContext(previous.get(), "EXTENSION_NOT_FOUND", "The extension is no longer available.");
    });
  }
  post([sp, opId] {
    Context* c = sp.get();
    ensureRuntime(c);
    host::result(opId, c->id, c->ctx != nullptr,
                 c->ctx ? okEnvelope()
                        : errorEnvelope("EXTENSION_ERROR", "The sandbox could not be started."));
  });
}

void evaluate(int64_t opId, const std::string& contextId, const std::string& runtimeJs,
              const std::string& entryJs, const std::string& moduleSource) {
  std::shared_ptr<Context> sp;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_contexts.find(contextId);
    if (it != g_contexts.end()) sp = it->second;
  }
  if (!sp) {
    host::result(opId, contextId, false,
                 errorEnvelope("EXTENSION_NOT_FOUND", "The extension is no longer available."));
    return;
  }
  ensureWorker();
  post([sp, opId, runtimeJs, entryJs, moduleSource] {
    doEvaluate(sp, opId, runtimeJs, entryJs, moduleSource);
  });
}

void call(int64_t opId, const std::string& contextId, const std::string& method,
          const std::string& argsJson, int64_t timeoutMs) {
  std::shared_ptr<Context> sp;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_contexts.find(contextId);
    if (it != g_contexts.end()) sp = it->second;
  }
  if (!sp) {
    host::result(opId, contextId, false,
                 errorEnvelope("EXTENSION_NOT_FOUND", "The extension is no longer available."));
    return;
  }
  ensureWorker();
  post([sp, opId, method, argsJson, timeoutMs] { doCall(sp, opId, method, argsJson, timeoutMs); });
}

void resolveHttp(const std::string& contextId, int64_t requestId, bool ok,
                 const std::string& payloadJson) {
  std::shared_ptr<Context> sp;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_contexts.find(contextId);
    if (it != g_contexts.end()) sp = it->second;
  }
  if (!sp) return;
  post([sp, requestId, ok, payloadJson] { doResolveHttp(sp, requestId, ok, payloadJson); });
}

void dispose(const std::string& contextId) {
  std::shared_ptr<Context> sp;
  {
    std::lock_guard<std::mutex> lock(g_mutex);
    auto it = g_contexts.find(contextId);
    if (it != g_contexts.end()) sp = it->second;
  }
  if (!sp) return;
  post([sp] { releaseContext(sp.get(), "EXTENSION_NOT_FOUND", "The extension is no longer available."); });
}

}  // namespace pixi
