/** Public SDK surface for extension authors (types are erased at build time). */
export { defineExtension } from './defineExtension.ts'
export { EXTENSION_API_VERSION, SUPPORTED_API_VERSIONS } from './types.ts'
export type {
  AnimeExtension,
  AnimeIdentifiers,
  AnimeTitles,
  ExtensionCapabilities,
  ExtensionContext,
  ExtensionManifest,
  ExtensionType,
  ExtensionUtils,
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  Logger,
  SourceRequest,
  StreamSource,
  StreamType,
  StructuredExtensionError,
  SubtitleRequest,
  SubtitleSource,
} from './types.ts'
export type { ExtensionErrorCode } from './types.ts'
