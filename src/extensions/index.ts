/**
 * Public extension-system surface — pages/hooks import from here.
 */

// SDK (what extension authors see)
export { defineExtension, EXTENSION_API_VERSION } from './sdk/index.ts'
export type {
  AnimeExtension,
  ExtensionContext,
  ExtensionManifest,
  SourceRequest,
  StreamSource,
  SubtitleSource,
} from './sdk/index.ts'

// Runtime / registry
export { useExtensionRegistry, selectEnabled } from './runtime/ExtensionRegistry.ts'
export type { ExtensionRecord } from './runtime/ExtensionRegistry.ts'
export { inspectExtension } from './runtime/ExtensionLoader.ts'
export type { InspectedExtension } from './runtime/ExtensionLoader.ts'
export { ExtensionError, toStructuredExtensionError } from './runtime/errors.ts'
export { compareVersions } from './runtime/version.ts'

// Aggregators + normalization
export { collectSources } from './providers/streaming.ts'
export type { SourcesResult, SourceOutcome } from './providers/streaming.ts'
export { collectSubtitles } from './providers/subtitles.ts'
export type { SubtitlesResult, SubtitleOutcome } from './providers/subtitles.ts'
export { buildSourceRequest } from './providers/request.ts'
export {
  embeddedSubtitles,
  mergeSubtitles,
  normalizeSources,
  normalizeSubtitles,
  qualityRank,
  sortSources,
} from './providers/normalize.ts'
export type { FlatSource, FlatSubtitle, ProviderMeta } from './providers/normalize.ts'

// Playback + subtitles
export { preparePlayback, revokePlayback } from './player/playbackAdapter.ts'
export type { PlaybackTarget } from './player/playbackAdapter.ts'
export { srtToVtt } from './subtitles/convert.ts'
