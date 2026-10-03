/**
 * pixi_sandbox — QuickJS extension runtime for Pixi Mobile.
 *
 * One JSRuntime per extension, evaluated on a dedicated worker thread so a
 * wedged extension can never stall the React Native JS thread. Deadlines are
 * enforced twice:
 *   - host-side: the worker wakes at each call's deadline and fails it, and
 *   - engine-side: JS_SetInterruptHandler aborts runaway bytecode in-place
 *     (an infinite loop inside an extension is cut at the deadline).
 *
 * On timeout the context is disposed and the next call boots a fresh one —
 * the exact recycle rule of the web's iframe sandbox.
 *
 * This file is platform-neutral (the Android JNI bridge and a future iOS
 * bridge both sit on top of it); it never touches React Native types.
 */
#pragma once

#include <cstdint>
#include <string>

namespace pixi {

/** Create a fresh JSRuntime/JSContext for `contextId`. */
void create(int64_t opId, const std::string& contextId);

/**
 * Evaluate the sandbox runtime script, then the entry module (which imports
 * the extension source). Resolves with the boot JSON
 * `{ok:true,manifest,methods}` or rejects with `{ok:false,err:{code,message}}`.
 */
void evaluate(int64_t opId, const std::string& contextId, const std::string& runtimeJs,
              const std::string& entryJs, const std::string& moduleSource);

/** Run one extension method under a host-enforced deadline. */
void call(int64_t opId, const std::string& contextId, const std::string& method,
          const std::string& argsJson, int64_t timeoutMs);

/** Deliver an HTTP response produced by the host policy layer. */
void resolveHttp(const std::string& contextId, int64_t requestId, bool ok,
                 const std::string& payloadJson);

/** Tear the context down; in-flight work fails with EXTENSION_NOT_FOUND. */
void dispose(const std::string& contextId);

}  // namespace pixi
