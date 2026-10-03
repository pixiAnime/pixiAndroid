/**
 * Extension SDK — the public, versionable contract between the website and
 * anime extensions (streaming + subtitle providers).
 *
 * This file is what extension authors import (types + defineExtension are
 * bundled into their build; the runtime passes `context` in at call time, so
 * no runtime SDK import is needed inside the sandbox).
 *
 * API versioning: manifest.apiVersion ("1" today). Unsupported versions are
 * rejected before installation — see runtime/validator.ts.
 */

/** The extension API version this build of the site understands. */
export const EXTENSION_API_VERSION = '1'

/** Extensions an author may declare support for. */
export const SUPPORTED_API_VERSIONS: readonly string[] = [EXTENSION_API_VERSION]

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

export interface ExtensionCapabilities {
  /** Provides getSources() — playable video for an episode. */
  streaming: boolean
  /** Provides getSubtitles() — subtitle tracks for an episode. */
  subtitles: boolean
}

/** Coarse legacy form — normalized to `capabilities` when present. */
export type ExtensionType = 'streaming' | 'subtitle' | 'both'

export interface ExtensionManifest {
  /** Stable kebab-case id, unique per extension. */
  id: string
  name: string
  author: string
  /** Dotted version, e.g. "1.0.0". */
  version: string
  /** Extension API version this extension requires ("1"). Defaults to "1". */
  apiVersion?: string
  description?: string
  /** https:// icon shown in the management UI (loaded by the site, not the extension). */
  icon?: string
  /** Preferred over `type` when both exist. */
  capabilities?: ExtensionCapabilities
  /** Legacy/alternative to capabilities. */
  type?: ExtensionType
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export interface AnimeTitles {
  english?: string
  romaji?: string
  native?: string
  synonyms?: string[]
}

/**
 * Stable identifiers handed to extensions — they never re-search the site
 * when an id is known. Both ids are best-effort: at least one is present.
 */
export interface AnimeIdentifiers {
  malId?: number
  anilistId?: number
  titles?: AnimeTitles
}

export interface EpisodeRef {
  /** 1-based episode number. */
  number: number
  /** Series season (1-based). */
  season?: number
  /** Absolute episode number across seasons, when known. */
  absoluteNumber?: number
}

export interface SourceRequest {
  anime: AnimeIdentifiers
  episode: EpisodeRef
}

/** Subtitle requests carry the same identity (+ titles for fuzzy matching). */
export type SubtitleRequest = SourceRequest

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/** How the player should treat the URL — normalized, never mime-guessed by the UI. */
export type StreamType = 'hls' | 'mp4' | 'webm' | 'unknown'

export interface SubtitleSource {
  url: string
  /** ISO 639-1/2 code, e.g. "en", "eng", "jpn". */
  language: string
  label?: string
  format: 'vtt' | 'srt' | 'ass' | 'unknown'
  default?: boolean
  /**
   * Headers the track requires (`Client-Protocol-Model`, `Referer`, `Origin`,
   * …). Media elements can't set headers, so the host fetches the file
   * through the pixiClient bridge in JSON form and hands the player a Blob —
   * sanitised with the same rules as `StreamSource.headers`.
   */
  headers?: Record<string, string>
}

export interface StreamSource {
  url: string
  type: StreamType
  /** Original MIME type when the provider knows it. */
  mimeType?: string
  /** Display label like "1080p". */
  quality?: string
  language?: string
  bitrate?: number
  size?: number
  isDefault?: boolean
  /**
   * Headers the provider requires (Referer/Origin/User-Agent/…). The runtime
   * routes these through pixiClient — media elements can't set them, so the
   * playback adapter applies them where the bridge allows (docs pixiClient §6.6/§6.8).
   */
  headers?: Record<string, string>
  /** Subtitles embedded alongside this stream. */
  subtitles?: SubtitleSource[]
}

/* ------------------------------------------------------------------ */
/* Context — injected by the runtime at call time                      */
/* ------------------------------------------------------------------ */

export interface HttpRequestOptions {
  /** Query params appended to the URL. */
  query?: Record<string, string | number | boolean>
  /** Upstream request headers — routed through pixiClient (never direct fetch). */
  headers?: Record<string, string>
  /** Request body: string sent as-is; objects are JSON-encoded. */
  body?: string | object | null
  /** Content-Type for the body (defaults to application/json for objects). */
  contentType?: string
  /** Per-request timeout override (ms), capped by the runtime maximum. */
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  ok: boolean
  headers: Record<string, string>
  /** Raw body text. */
  text: string
  /** Parse the body as JSON — throws a structured error when it isn't JSON. */
  json<T = unknown>(): T
}

export interface HttpClient {
  get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>
  post(url: string, body?: string | object | null, options?: HttpRequestOptions): Promise<HttpResponse>
  request(options: HttpRequestOptions & { url: string; method?: string }): Promise<HttpResponse>
}

export interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface ExtensionUtils {
  sleep(ms: number): Promise<void>
  /** Build a URL with query params — same semantics as context.http's `query`. */
  withQuery(url: string, query?: HttpRequestOptions['query']): string
}

export interface ExtensionContext {
  http: HttpClient
  logger: Logger
  utils: ExtensionUtils
}

/* ------------------------------------------------------------------ */
/* The extension interface                                             */
/* ------------------------------------------------------------------ */

export interface AnimeExtension {
  manifest: ExtensionManifest
  /** Streaming providers: return one or more playable sources. */
  getSources?(context: ExtensionContext, request: SourceRequest): Promise<StreamSource[]>
  /** Subtitle providers: return subtitle tracks (independent of streaming). */
  getSubtitles?(context: ExtensionContext, request: SubtitleRequest): Promise<SubtitleSource[]>
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const EXTENSION_ERROR_CODES = [
  'EXTENSION_ERROR', // generic extension failure
  'EXTENSION_TIMEOUT', // execution deadline exceeded
  'EXTENSION_NOT_FOUND', // unknown / disabled / removed id
  'VALIDATION_FAILED', // manifest or module rejected
  'API_VERSION_UNSUPPORTED', // apiVersion not supported by this site
  'INVALID_RESULT', // extension returned an unusable value
  'PIXICLIENT_UNAVAILABLE', // pixiClient is not running
  'PIXICLIENT_ERROR', // bridge rejected the request
  'HTTP_ERROR', // upstream responded with an error status
  'HTTP_TIMEOUT', // extension HTTP request timed out
] as const

export type ExtensionErrorCode = (typeof EXTENSION_ERROR_CODES)[number]

/** Structured error as it crosses the extension boundary (spec §27). */
export interface StructuredExtensionError {
  extensionId?: string
  code: ExtensionErrorCode
  message: string
}
