/**
 * RepoLoader — download + validate a repository manifest (mobile-owned).
 *
 * A repository is a plain JSON document:
 *
 * ```json
 * {
 *   "name": "Pixi Providers",
 *   "version": "1",
 *   "icon": "https://…/repo.png",
 *   "providers": [
 *     {
 *       "id": "ayruki-auto",
 *       "name": "Ayruki Auto",
 *       "author": "Ayruki",
 *       "version": "1.1.0",
 *       "apiVersion": "1",
 *       "description": "…",
 *       "icon": "https://…/favicon.ico",
 *       "url": "https://…/ayruki-auto.js"
 *     }
 *   ]
 * }
 * ```
 *
 * Nothing here executes provider code: it only downloads and validates the
 * manifest. Each provider `url` is later handed to the existing
 * `inspectExtension` (download → transient sandbox → validate) before install.
 *
 * This is intentionally a separate module from the synced `validator.ts` /
 * `ExtensionLoader.ts`: the repository schema is Android-owned and must not
 * drift the pixiWeb-synced files.
 */
import { ExtensionError, toStructuredExtensionError } from '../runtime/errors.ts'
import { POLICY } from '../runtime/policy.ts'
import { SUPPORTED_API_VERSIONS } from '../sdk/types.ts'
import type { RepoManifest, RepoProvider } from './types.ts'

/**
 * Manifest download deadline. Matches the extension HTTP default (15s) but is
 * kept local so this module has no dependency on `@/config` — which lets it be
 * unit-tested directly under Node without the Metro alias resolver.
 */
const REPO_TIMEOUT_MS = 15_000

export interface InspectedRepository {
  /** Canonical manifest URL. */
  url: string
  manifest: RepoManifest
}

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/
const MAX_PROVIDERS = 200

function fail(message: string): never {
  throw new ExtensionError('VALIDATION_FAILED', message)
}

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`The repository manifest is missing a valid "${field}".`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    fail(`The repository manifest "${field}" is too long (max ${max} characters).`)
  }
  return trimmed
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    fail(`The repository manifest "${field}" must be text.`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    fail(`The repository manifest "${field}" is too long (max ${max} characters).`)
  }
  return trimmed
}

function httpUrl(value: unknown, field: string): string {
  const raw = requireString(value, field, POLICY.maxUrlLength)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail(`The repository manifest "${field}" must be a valid http(s) URL.`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`The repository manifest "${field}" must be a valid http(s) URL.`)
  }
  return url.toString()
}

function optionalHttpUrl(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return httpUrl(value, field)
}

/** `https://host/path/ayruki-auto.js` → `ayruki-auto`. */
function deriveId(url: string): string {
  const path = url.split('?')[0].split('#')[0]
  const base = path.split('/').pop() ?? ''
  const slug = base
    .replace(/\.(js|mjs|cjs)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
  return slug
}

function validateProvider(raw: unknown, repoAuthor: string | undefined): RepoProvider {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('The repository manifest has a provider that is not an object.')
  }
  const entry = raw as Record<string, unknown>
  const url = httpUrl(entry.url ?? entry.source ?? entry.file, 'providers[].url')

  const declaredId = optionalString(entry.id, 'providers[].id', 64)
  const derivedId = deriveId(url)
  const id = declaredId ?? derivedId
  if (!id || id.length < 2 || !ID_RE.test(id)) {
    fail('The repository manifest "providers[].id" must be lowercase letters, digits, dots, dashes or underscores.')
  }

  const name = requireString(entry.name, 'providers[].name', 100)
  const author = optionalString(entry.author, 'providers[].author', 100) ?? repoAuthor ?? 'Unknown'

  const version = optionalString(entry.version, 'providers[].version', 32) ?? ''
  if (version && !VERSION_RE.test(version)) {
    fail('The repository manifest "providers[].version" must look like 1.0.0.')
  }

  const apiVersion = optionalString(entry.apiVersion, 'providers[].apiVersion', 16)
  if (apiVersion && !SUPPORTED_API_VERSIONS.includes(apiVersion)) {
    fail('The repository lists a provider that requires a newer extension API.')
  }

  const provider: RepoProvider = {
    id,
    name,
    author,
    version,
    url,
  }
  const description = optionalString(entry.description, 'providers[].description', 1000)
  if (description) provider.description = description
  if (apiVersion) provider.apiVersion = apiVersion
  const icon = optionalHttpUrl(entry.icon, 'providers[].icon')
  if (icon) provider.icon = icon
  return provider
}

/** Validate an already-parsed object. Pure — exported for tests. */
export function validateRepoManifest(raw: unknown): RepoManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('The repository manifest must be a JSON object.')
  }
  const data = raw as Record<string, unknown>
  const name = requireString(data.name, 'name', 100)
  const author = optionalString(data.author, 'author', 100)
  const version = optionalString(data.version, 'version', 32)

  if (!Array.isArray(data.providers) || data.providers.length === 0) {
    fail('The repository manifest lists no providers.')
  }
  if (data.providers.length > MAX_PROVIDERS) {
    fail('The repository manifest lists too many providers.')
  }

  const providers = data.providers.map((provider) => validateProvider(provider, author))

  const manifest: RepoManifest = { name, providers }
  if (author) manifest.author = author
  if (version) manifest.version = version
  // The repository's own artwork. Optional: manifests written before it had an
  // icon still validate, and the UI falls back to a generic mark.
  const icon = optionalHttpUrl(data.icon, 'icon')
  if (icon) manifest.icon = icon
  return manifest
}

/** Abort detection without `DOMException`, which Hermes does not expose. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  )
}

/**
 * Download + validate a repository manifest. Throws structured errors whose
 * `message` is safe to show directly in the UI.
 */
export async function inspectRepository(rawUrl: string): Promise<InspectedRepository> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new ExtensionError('VALIDATION_FAILED', 'Enter a valid repository URL beginning with http:// or https://.')
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.toString().length > POLICY.maxUrlLength
  ) {
    throw new ExtensionError('VALIDATION_FAILED', 'Enter a valid repository URL beginning with http:// or https://.')
  }
  const target = url.toString()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REPO_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(target, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
    } catch (err) {
      if (isAbortError(err)) {
        throw new ExtensionError('VALIDATION_FAILED', 'The repository took too long to load. Check the URL and try again.')
      }
      throw toErr(err)
    }

    if (!res.ok) {
      throw new ExtensionError('VALIDATION_FAILED', 'The repository manifest could not be downloaded. Check the URL and try again.')
    }

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (Number.isFinite(declared) && declared > POLICY.maxExtensionBytes) {
      throw new ExtensionError('VALIDATION_FAILED', 'The repository manifest is too large.')
    }

    const text = await res.text()
    if (text.length === 0) {
      throw new ExtensionError('VALIDATION_FAILED', 'The repository manifest is empty.')
    }
    if (text.length > POLICY.maxExtensionBytes) {
      throw new ExtensionError('VALIDATION_FAILED', 'The repository manifest is too large.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ExtensionError('VALIDATION_FAILED', 'That URL did not return a JSON repository manifest.')
    }

    return { url: target, manifest: validateRepoManifest(parsed) }
  } finally {
    clearTimeout(timer)
  }
}

function toErr(err: unknown): ExtensionError {
  const s = toStructuredExtensionError(err)
  return new ExtensionError(s.code, s.message, s.extensionId)
}
