/**
 * Typed, centralized configuration.
 * No other module reads environment values directly.
 *
 * The mobile build has no `import.meta.env` (there is no bundler env-file
 * step), so values fall back to the same defaults the web build ships. Each
 * key is still consulted from `process.env` first, so a
 * `transform-inline-environment-variables` pass (or a generated bootstrap)
 * can override any of them without touching this file.
 *
 * `pixiClient` is retained for source compatibility with shared modules: on
 * mobile the bridge it described (`127.0.0.1:8765`) does not exist — its
 * work lives in the native HTTP layer — and `PIXICLIENT_UNAVAILABLE` is
 * therefore unreachable, though the error code stays in the enum. Jikan has
 * no `forceBridge` switch here for the same reason: Android has no CORS.
 */

interface AppConfig {
  jikan: {
    baseUrl: string
  }
  anilist: {
    /** GraphQL endpoint of the automatic fallback source. */
    baseUrl: string
  }
  pixiClient: {
    baseUrl: string
    downloadUrl: string
    /** Optional auth token (X-Pixi-Token) when enabled in the app settings. */
    token: string
  }
  extensions: {
    /** Per-request deadline for extension HTTP calls (ms). */
    httpTimeoutMs: number
    /** Whole-extension execution deadline per provider call (ms). */
    execTimeoutMs: number
  }
}

type EnvRecord = Record<string, unknown>

function envSource(): EnvRecord {
  try {
    const runtime = (typeof process !== 'undefined' ? process : undefined) as
      | { env?: EnvRecord }
      | undefined
    return runtime?.env ?? {}
  } catch {
    return {}
  }
}

const env: EnvRecord = envSource()

function readString(key: string, fallback: string): string {
  const raw = env[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim().replace(/\/+$/, '') : fallback
}

function readNumber(key: string, fallback: number): number {
  const raw = env[key]
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config: AppConfig = {
  jikan: {
    baseUrl: readString('VITE_JIKAN_API_URL', 'https://api.jikan.moe/v4'),
  },
  anilist: {
    baseUrl: readString('VITE_ANILIST_API_URL', 'https://graphql.anilist.co'),
  },
  pixiClient: {
    baseUrl: readString('VITE_PIXICLIENT_URL', 'http://127.0.0.1:8765'),
    downloadUrl: readString('VITE_PIXICLIENT_DOWNLOAD_URL', ''),
    token: readString('VITE_PIXICLIENT_TOKEN', ''),
  },
  extensions: {
    httpTimeoutMs: readNumber('VITE_EXT_HTTP_TIMEOUT_MS', 15_000),
    execTimeoutMs: readNumber('VITE_EXT_EXEC_TIMEOUT_MS', 20_000),
  },
}
