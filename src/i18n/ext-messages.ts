/**
 * Maps the *exact* fixed English messages produced by the extension runtime
 * (sandbox, loader, validator, policy, http, playback adapter, normalizer)
 * onto `extMsg.*` translation keys.
 *
 * - English values in `en.ts` are byte-identical to these messages, so the
 *   English UI never changes (and e2e assertions keep passing).
 * - Dynamic messages (validators that append field/detail text) are absent
 *   from the map and fall back to their original English text unchanged.
 */
export const EXT_MESSAGE_KEYS: Record<string, string> = {
  // ExtensionSandbox
  'The extension took too long to respond.': 'extMsg.timeoutRespond',
  'The extension took too long to load.': 'extMsg.timeoutLoad',
  'The extension is no longer available.': 'extMsg.noLongerAvailable',
  'The extension could not be loaded in this browser.': 'extMsg.sandboxUnavailable',
  'The extension could not be loaded.': 'extMsg.loadFailed',
  // errors.ts (generic fallback)
  'The extension failed while processing the request.': 'extMsg.generic',
  // ExtensionLoader
  'Enter a valid extension URL beginning with http:// or https://.': 'extMsg.invalidUrl',
  'pixiClient is not running.': 'extMsg.pixiNotRunning',
  'The extension could not be downloaded. Check the URL and try again.':
    'extMsg.downloadFailed',
  'The download took too long. Check the URL and try again.': 'extMsg.downloadTimeout',
  'The extension file is too large.': 'extMsg.fileTooLarge',
  'The extension file is empty.': 'extMsg.fileEmpty',
  'Network access is not available before installation.': 'extMsg.preInstallNetwork',
  // bootstrap (inside the sandbox)
  'The extension file could not be loaded.': 'extMsg.fileNotLoaded',
  'The extension does not export a manifest.': 'extMsg.noManifest',
  'The extension manifest contains unusable data.': 'extMsg.manifestUnusable',
  'The extension returned data that cannot be used.': 'extMsg.invalidData',
  // validator
  'The manifest "icon" must be a valid http(s) URL.': 'extMsg.iconInvalid',
  'The manifest capabilities do not match the implemented methods.': 'extMsg.capsMismatch',
  'The manifest type does not match the implemented methods.': 'extMsg.typeMismatch',
  'The extension implements neither getSources() nor getSubtitles().': 'extMsg.neitherMethods',
  'The extension does not export a valid manifest.': 'extMsg.noValidManifest',
  'The manifest "id" must be lowercase letters, digits, dots, dashes or underscores.':
    'extMsg.idInvalid',
  'The manifest "version" must look like 1.0.0.': 'extMsg.versionInvalid',
  'This extension requires a newer extension API.': 'extMsg.apiTooNew',
  // policy
  'The extension provided an invalid URL.': 'extMsg.badUrlFromExt',
  'Only http(s) URLs are allowed.': 'extMsg.onlyHttp',
  'The extension built an over-long URL.': 'extMsg.overLongUrl',
  'The request body is too large.': 'extMsg.bodyTooLarge',
  // http
  'The request took too long and was cancelled.': 'extMsg.timeoutRequest',
  'The response was too large to process.': 'extMsg.httpTooLarge',
  'The bridge could not complete the request.': 'extMsg.bridgeRequest',
  'The request could not be completed.': 'extMsg.httpFailed',
  // playback adapter
  'The bridge could not load this stream.': 'extMsg.bridgeLoadStream',
  'The stream could not be loaded.': 'extMsg.streamLoad',
  'The stream returned an invalid playlist.': 'extMsg.streamPlaylist',
  // normalizer
  'The extension did not return a list of sources.': 'extMsg.noSourcesResult',
  'The extension did not return a list of subtitles.': 'extMsg.noSubtitlesResult',
  // bridge client default
  'pixiClient is not reachable': 'extMsg.pixiUnreachable',
  // player (playback preparation)
  'This browser cannot play this stream format.': 'extMsg.playerCannotPlay',
  'Playback failed — the stream could not be loaded.': 'extMsg.playbackFailed',
  'Playback could not be started.': 'extMsg.playbackNotStarted',
  'This stream could not be played.': 'extMsg.streamNotPlayed',
}

/**
 * Translate a runtime message when it is one of the known fixed diagnostics;
 * anything else (dynamic/validator detail text) passes through unchanged.
 */
export function localizeExtensionMessage(
  message: string,
  t: (key: string) => string,
): string {
  const key = EXT_MESSAGE_KEYS[message]
  return key ? t(key) : message
}
