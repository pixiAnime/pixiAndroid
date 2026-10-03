/**
 * PlaybackAdapter — normalized source → playable URL (spec §30).
 *
 * The player never sees provider details; everything funnels through here.
 * On the web every path routes through pixiClient (decision D5) because a
 * `<video>` element cannot send upstream headers and CORS blocks direct
 * media fetches. Android needs neither:
 *
 *   - react-native-video (ExoPlayer) attaches request headers natively and
 *     applies them to the playlist *and* its segment requests, so a protected
 *     HLS stream plays straight from the origin — no rewriting step;
 *   - there is no CORS layer, so MP4/WebM Range requests (seek included)
 *     work as they are.
 *
 * The bridge's `bridgeRequestUrl` / `bridgePlaylistUrl` / Blob rewriting
 * therefore collapse to a passthrough: `headers` and the container hint are
 * handed straight to the player. `isBlob` stays in the shape for source
 * compatibility — it is always false here, so `revokePlayback` never has
 * anything to release.
 *
 * The one thing ExoPlayer needs that the web never did is the *container*,
 * because it is chosen from the URL's path rather than sniffed — see
 * `playbackContentType`.
 */
import { assertHttpUrl } from '../runtime/policy.ts'
import { ExtensionError } from '../runtime/errors.ts'
import type { StreamSource } from '../sdk/types.ts'

export interface PlaybackTarget {
  url: string
  /** True when the caller must revokeObjectURL() on change/unmount. Never on native. */
  isBlob: boolean
  /** Upstream headers the player must attach to this stream. */
  headers?: Record<string, string>
  /**
   * Container override for react-native-video's `source.type` — the file
   * extension ExoPlayer should assume the URL serves. `undefined` means
   * "infer it from the URL", which is what happens for every URL that already
   * names its format. See `playbackContentType`.
   */
  contentType?: string
}

/* ------------------------------------------------------------------ */
/* Container inference                                                  */
/* ------------------------------------------------------------------ */

const HLS_MIME = /mpegurl/i
const DASH_MIME = /dash\+xml/i
/** A container named anywhere in the URL — a proxy keeps it in its query. */
const HLS_IN_URL = /\.m3u8?([/?#&]|$)/i
const DASH_IN_URL = /\.mpd([/?#&]|$)/i
/** Containers ExoPlayer already infers on its own (`.m3u8` → HLS, `.mpd` → DASH). */
const SELF_INFERRED = new Set(['m3u8', 'm3u', 'mpd'])

/** File extension of the URL's *path*, query and fragment stripped. */
function pathExtension(url: string): string | undefined {
  const path = url.split(/[?#]/, 1)[0] ?? ''
  const segment = path.slice(path.lastIndexOf('/') + 1)
  const dot = segment.lastIndexOf('.')
  return dot > 0 ? segment.slice(dot + 1).toLowerCase() : undefined
}

/**
 * Which container to force on the player, if any.
 *
 * react-native-video picks its `MediaSource` with `Util.inferContentType()`
 * over the URI's **path only** (`ReactExoplayerView.buildMediaSource`), so a
 * provider that serves HLS behind an endpoint like
 *
 *     https://host/proxy?url=…%2Fmaster.m3u8&ref=…
 *
 * resolves to `CONTENT_TYPE_OTHER`: ExoPlayer builds a *Progressive*MediaSource,
 * runs the file extractors over an `#EXTM3U` document, and fails with
 * `ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED` (an `UnrecognizedInputFormatException`
 * from `BundledExtractorsAdapter`). Browsers don't have this problem because
 * they sniff the bytes instead of the URL — which is exactly why the same
 * extension URL plays on the web app and not here.
 *
 * `source.type` is RNV's documented override for this case (`Source.kt` reads
 * `type` into `Source.extension`, which `buildMediaSource` feeds to
 * `inferContentType`). The override is skipped only when the path already names
 * a container ExoPlayer keys off itself — `.m3u8`/`.m3u`/`.mpd` — so any URL
 * that already resolved to the right `MediaSource` is left exactly as it was.
 */
export function playbackContentType(source: StreamSource): string | undefined {
  const extension = pathExtension(source.url)
  if (extension && SELF_INFERRED.has(extension)) return undefined

  const mimeType = source.mimeType ?? ''
  if (HLS_MIME.test(mimeType) || source.type === 'hls') return 'm3u8'
  if (DASH_MIME.test(mimeType)) return 'mpd'

  // No reliable label: fall back to a container hint embedded in the URL, the
  // way a proxied playlist carries `…/master.m3u8` inside its query.
  if (source.type === 'unknown') {
    if (DASH_IN_URL.test(source.url)) return 'mpd'
    if (HLS_IN_URL.test(source.url)) return 'm3u8'
  }
  return undefined
}

export async function preparePlayback(source: StreamSource): Promise<PlaybackTarget> {
  let url: string
  try {
    url = assertHttpUrl(source.url)
  } catch {
    throw new ExtensionError('HTTP_ERROR', 'The stream could not be loaded.')
  }
  const headers =
    source.headers && Object.keys(source.headers).length > 0 ? source.headers : undefined
  const contentType = playbackContentType(source)
  return { url, isBlob: false, ...(headers ? { headers } : {}), ...(contentType ? { contentType } : {}) }
}

export function revokePlayback(_target?: PlaybackTarget | null): void {
  // No blob URLs are ever produced on native — nothing to revoke.
}
