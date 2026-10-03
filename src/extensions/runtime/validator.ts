/**
 * Manifest + module validation (spec §19/§23). Pure — runs against data
 * already read inside a transient sandbox; nothing here executes code.
 * Every message is friendly copy that is safe to show directly in the UI.
 */
import { SUPPORTED_API_VERSIONS, type ExtensionCapabilities, type ExtensionManifest } from '../sdk/types.ts'
import { ExtensionError } from './errors.ts'

export interface MethodProbe {
  getSources: boolean
  getSubtitles: boolean
}

export interface ValidatedExtension {
  manifest: ExtensionManifest
  capabilities: ExtensionCapabilities
}

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

function fail(message: string, code: 'VALIDATION_FAILED' | 'API_VERSION_UNSUPPORTED' = 'VALIDATION_FAILED'): never {
  throw new ExtensionError(code, message)
}

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`The manifest is missing a valid "${field}".`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    fail(`The manifest "${field}" is too long (max ${max} characters).`)
  }
  return trimmed
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    fail(`The manifest "${field}" must be text.`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    fail(`The manifest "${field}" is too long (max ${max} characters).`)
  }
  return trimmed
}

function httpIcon(value: unknown): string | undefined {
  const icon = optionalString(value, 'icon', 2048)
  if (!icon) return undefined
  let url: URL
  try {
    url = new URL(icon)
  } catch {
    fail('The manifest "icon" must be a valid http(s) URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('The manifest "icon" must be a valid http(s) URL.')
  }
  return icon
}

function deriveCapabilities(
  raw: ExtensionManifest,
  methods: MethodProbe,
): ExtensionCapabilities {
  const declared = raw.capabilities
  const type = raw.type

  if (declared && typeof declared === 'object') {
    const caps: ExtensionCapabilities = {
      streaming: declared.streaming === true,
      subtitles: declared.subtitles === true,
    }
    if (caps.streaming !== methods.getSources || caps.subtitles !== methods.getSubtitles) {
      fail('The manifest capabilities do not match the implemented methods.')
    }
    return caps
  }

  if (type === 'streaming' || type === 'subtitle' || type === 'both') {
    const caps: ExtensionCapabilities = {
      streaming: type === 'streaming' || type === 'both',
      subtitles: type === 'subtitle' || type === 'both',
    }
    if (caps.streaming !== methods.getSources || caps.subtitles !== methods.getSubtitles) {
      fail('The manifest type does not match the implemented methods.')
    }
    return caps
  }

  // No declared capabilities — derive from what the module implements.
  const caps: ExtensionCapabilities = {
    streaming: methods.getSources,
    subtitles: methods.getSubtitles,
  }
  if (!caps.streaming && !caps.subtitles) {
    fail('The extension implements neither getSources() nor getSubtitles().')
  }
  return caps
}

/** Validate a manifest read from a sandboxed module. Throws ExtensionError. */
export function validateManifest(raw: unknown, methods: MethodProbe): ValidatedExtension {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('The extension does not export a valid manifest.')
  }
  const manifest = raw as ExtensionManifest

  const id = requireString(manifest.id, 'id', 64)
  if (!ID_RE.test(id) || id.length < 2) {
    fail('The manifest "id" must be lowercase letters, digits, dots, dashes or underscores.')
  }
  const name = requireString(manifest.name, 'name', 100)
  const author = requireString(manifest.author, 'author', 100)
  const version = requireString(manifest.version, 'version', 32)
  if (!VERSION_RE.test(version)) {
    fail('The manifest "version" must look like 1.0.0.')
  }

  const apiVersion = optionalString(manifest.apiVersion, 'apiVersion', 16) ?? '1'
  if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
    fail('This extension requires a newer extension API.', 'API_VERSION_UNSUPPORTED')
  }

  const capabilities = deriveCapabilities(manifest, methods)
  const normalized: ExtensionManifest = {
    id,
    name,
    author,
    version,
    apiVersion,
    description: optionalString(manifest.description, 'description', 1000),
    icon: httpIcon(manifest.icon),
    capabilities,
  }

  return { manifest: normalized, capabilities }
}
