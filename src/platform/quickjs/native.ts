/**
 * Typed accessor for the `PixiSandbox` native module.
 *
 * Deliberately a legacy (`ReactContextBaseJavaModule`) module registered by
 * hand rather than a TurboModule: the C++ runtime has no codegen surface and
 * no React Native C++ dependency, only plain JNI. It is reached through the
 * bridge's interop layer, which is exactly what `NativeModules.X` resolves to.
 */
import { NativeModules, Platform } from 'react-native'

import { parseEnvelope, type SandboxEnvelope } from './types'

export interface PixiSandboxNativeModule {
  /** Boot a fresh JSRuntime for `contextId`. Resolves with an envelope. */
  create(contextId: string): Promise<string>
  /**
   * Evaluate the sandbox bootstrap (global script) and the entry module
   * (ES module importing `pixi:extension`). Resolves with a boot envelope.
   */
  evaluate(
    contextId: string,
    runtimeJs: string,
    entryJs: string,
    moduleSource: string,
  ): Promise<string>
  /** Run one extension method under a host-enforced deadline. */
  call(
    contextId: string,
    method: string,
    argsJson: string,
    timeoutMs: number,
  ): Promise<string>
  /** Answer a `PixiSandbox:hostRequest` event raised by the sandbox. */
  resolveHttp(
    contextId: string,
    requestId: number,
    ok: boolean,
    payloadJson: string,
  ): void
  /** Tear down the JSRuntime (also rejects any in-flight work). */
  dispose(contextId: string): void
}

let cached: PixiSandboxNativeModule | null = null

/** Resolve the native module, with an actionable message when it is absent. */
export function pixiSandboxModule(): PixiSandboxNativeModule {
  if (cached) return cached
  const candidate = (NativeModules as Record<string, PixiSandboxNativeModule | undefined>)
    .PixiSandbox
  if (!candidate || typeof candidate.create !== 'function') {
    throw new Error(
      Platform.OS === 'android'
        ? 'The native extension sandbox is missing. Rebuild the app from source (`npm run android`).'
        : 'The extension sandbox is not available on this platform in this build.',
    )
  }
  cached = candidate
  return candidate
}

/** Convenience wrapper so callers never deal with raw envelope strings. */
export async function runNative(
  work: (module: PixiSandboxNativeModule) => Promise<string>,
): Promise<SandboxEnvelope> {
  const module = pixiSandboxModule()
  let raw: string
  try {
    raw = await work(module)
  } catch (error) {
    return {
      ok: false,
      err: {
        code: 'EXTENSION_ERROR',
        message: error instanceof Error ? error.message : 'The sandbox is unavailable.',
      },
    }
  }
  return parseEnvelope(raw)
}
