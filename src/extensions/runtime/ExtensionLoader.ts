/**
 * Extension loading (spec §19): download → evaluate in a TRANSIENT sandbox
 * → validate manifest → hand back an inspected candidate.
 *
 * Downloads are a plain `fetch` — Android has no CORS layer, so the bridge
 * the web build relies on (decision D5) has no counterpart here; a stalled
 * host simply fails with the structured VALIDATION_FAILED copy the UI shows.
 */
import { ExtensionSandbox, type SandboxMethods } from './ExtensionSandbox.ts'
import { HTTP_TIMEOUT_MS } from './config.ts'
import { ExtensionError, toStructuredExtensionError } from './errors.ts'
import { POLICY, looksLikeHtml } from './policy.ts'
import { validateManifest } from './validator.ts'
import type { ExtensionCapabilities, ExtensionManifest } from '../sdk/types.ts'

export interface InspectedExtension {
  url: string
  source: string
  manifest: ExtensionManifest
  capabilities: ExtensionCapabilities
  methods: SandboxMethods
}

function userUrlError(): ExtensionError {
  return new ExtensionError('VALIDATION_FAILED', 'Enter a valid extension URL beginning with http:// or https://.')
}

/** Abort detection without `DOMException`, which Hermes does not expose. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/** Fetch the module source. Throws structured errors. */
export async function downloadExtension(rawUrl: string): Promise<{ url: string; source: string }> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw userUrlError()
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.toString().length > POLICY.maxUrlLength
  ) {
    throw userUrlError()
  }
  const target = url.toString()

  // Install downloads carry a deadline too — a stalled host can't hang the form.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(target, { signal: controller.signal })
    } catch (err) {
      if (isAbortError(err)) {
        throw new ExtensionError('VALIDATION_FAILED', 'The download took too long. Check the URL and try again.')
      }
      throw toErr(err)
    }

    if (!res.ok) {
      throw new ExtensionError(
        'VALIDATION_FAILED',
        'The extension could not be downloaded. Check the URL and try again.',
      )
    }

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > POLICY.maxExtensionBytes) {
      throw new ExtensionError('VALIDATION_FAILED', 'The extension file is too large.')
    }

    const source = await res.text()
    if (source.length === 0) {
      throw new ExtensionError('VALIDATION_FAILED', 'The extension file is empty.')
    }
    if (source.length > POLICY.maxExtensionBytes) {
      throw new ExtensionError('VALIDATION_FAILED', 'The extension file is too large.')
    }
    if (looksLikeHtml(source)) {
      throw new ExtensionError(
        'VALIDATION_FAILED',
        'That URL returned a web page, not a JavaScript extension module.',
      )
    }
    return { url: target, source }
  } catch (err) {
    if (isAbortError(err)) {
      throw new ExtensionError('VALIDATION_FAILED', 'The download took too long. Check the URL and try again.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function toErr(err: unknown): ExtensionError {
  const s = toStructuredExtensionError(err)
  return new ExtensionError(s.code, s.message, s.extensionId)
}

/**
 * Download + evaluate + validate. The module is ONLY ever evaluated inside
 * a transient sandbox with networking denied — never in the app itself.
 */
export async function inspectExtension(rawUrl: string): Promise<InspectedExtension> {
  const { url, source } = await downloadExtension(rawUrl)

  const sandbox = new ExtensionSandbox(
    source,
    'inspection',
    () =>
      Promise.reject(
        new ExtensionError('EXTENSION_ERROR', 'Network access is not available before installation.'),
      ),
  )
  try {
    const info = await sandbox.start()
    const { manifest, capabilities } = validateManifest(info.manifest, info.methods)
    if (__DEV__) {
      console.debug(
        `[ext] inspected ${manifest.id}@${manifest.version} (${capabilities.streaming ? 'streaming' : ''}${capabilities.streaming && capabilities.subtitles ? '+' : ''}${capabilities.subtitles ? 'subtitles' : ''})`,
      )
    }
    return { url, source, manifest, capabilities, methods: info.methods }
  } finally {
    sandbox.dispose()
  }
}
