/**
 * pixi_host — the sandbox's up-calls to the platform (Kotlin on Android).
 *
 * Implemented in the platform's JNI bridge. Every call may arrive from the
 * sandbox worker thread, never from the React Native JS thread.
 */
#pragma once

#include <cstdint>
#include <string>

namespace pixi {
namespace host {

/** Settle one pending RN promise for `opId` (`payloadJson` is JSON). */
void result(int64_t opId, const std::string& contextId, bool ok, const std::string& payloadJson);

/** The sandbox performed a `context.http` call — route it to the TS policy layer. */
void hostRequest(const std::string& contextId, int64_t requestId, const std::string& requestJson);

/** `console.*` / `context.logger.*` output from inside the sandbox. */
void log(const std::string& contextId, const char* level, const std::string& message);

}  // namespace host
}  // namespace pixi
