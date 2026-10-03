#!/usr/bin/env node
/**
 * Extension compatibility gate.
 *
 * The core promise of this project is that ONE extension URL installs and
 * runs unchanged on both the web app and this Android app. This script proves
 * the static half of that promise without a device:
 *
 *  A. every extension in `../pixiWeb/extensions` is a self-contained ESM
 *     module that actually evaluates (in Node, with `window`/`document`/
 *     `localStorage` absent, exactly like the QuickJS sandbox denies them)
 *     and exports a manifest the shared validator would accept;
 *  B. the runtime contract the mobile sandbox implements — API version, the
 *     error-code vocabulary, and the shared bootstrap error copy — matches
 *     the web's iframe bootstrap.
 *
 * The dynamic half (booting these same modules inside QuickJS on a device)
 * is `src/dev/sandboxSpike.ts`.
 *
 * Usage: npm run compat
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = resolve(root, '..', 'pixiWeb')

const { POLICY, looksLikeHtml } = await import(
  pathToFileURL(join(root, 'src/extensions/runtime/policy.ts')).href
)
const { EXTENSION_API_VERSION, SUPPORTED_API_VERSIONS } = await import(
  pathToFileURL(join(root, 'src/extensions/sdk/types.ts')).href
)

const failures = []
const notes = []

function fail(where, message) {
  failures.push(`${where}: ${message}`)
}

function ok(message) {
  notes.push(message)
}

/* ------------------------------------------------------------------ */
/* A. The extension corpus                                             */
/* ------------------------------------------------------------------ */

function collectExtensionFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectExtensionFiles(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out.sort()
}

/** Bare `import`/`export … from` means the module needs a bundler. */
const BARE_IMPORT = /^\s*(import|export)[^;]*?from\s*['"][^'".][^'"]*['"]/m

const files = collectExtensionFiles(join(webRoot, 'extensions'))
if (files.length === 0) fail('corpus', `no extensions found under ${webRoot}/extensions`)

for (const file of files) {
  const where = relative(webRoot, file)
  const source = readFileSync(file, 'utf8')

  if (source.length > POLICY.maxExtensionBytes) {
    fail(where, `source is ${source.length} bytes — over the ${POLICY.maxExtensionBytes} limit`)
    continue
  }
  if (looksLikeHtml(source)) {
    fail(where, 'file is HTML, not a JavaScript module')
    continue
  }
  if (BARE_IMPORT.test(source)) {
    fail(where, 'imports a bare specifier — extensions must be self-contained')
  }

  let mod
  try {
    mod = await import(pathToFileURL(file).href)
  } catch (error) {
    fail(where, `does not evaluate: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }

  const extension = mod.default
  if (!extension || typeof extension !== 'object') {
    fail(where, 'default export is missing or not an object')
    continue
  }

  const manifest = extension.manifest
  if (!manifest || typeof manifest !== 'object') {
    fail(where, 'manifest is missing')
    continue
  }

  for (const field of ['id', 'name', 'author', 'version']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim().length === 0) {
      fail(where, `manifest.${field} is missing`)
    }
  }
  if (typeof manifest.id === 'string' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.id)) {
    fail(where, `manifest.id "${manifest.id}" is not kebab-case`)
  }

  const apiVersion = manifest.apiVersion ?? '1'
  if (!SUPPORTED_API_VERSIONS.includes(apiVersion)) {
    fail(where, `manifest.apiVersion "${apiVersion}" is not supported (supported: ${SUPPORTED_API_VERSIONS.join(', ')})`)
  }

  const hasSources = typeof extension.getSources === 'function'
  const hasSubtitles = typeof extension.getSubtitles === 'function'
  if (!hasSources && !hasSubtitles) {
    fail(where, 'implements neither getSources() nor getSubtitles()')
  }

  const capabilities = manifest.capabilities
  if (capabilities && typeof capabilities === 'object') {
    if (Boolean(capabilities.streaming) !== hasSources) {
      fail(where, `capabilities.streaming=${Boolean(capabilities.streaming)} but getSources is ${hasSources ? 'implemented' : 'missing'}`)
    }
    if (Boolean(capabilities.subtitles) !== hasSubtitles) {
      fail(where, `capabilities.subtitles=${Boolean(capabilities.subtitles)} but getSubtitles is ${hasSources && hasSubtitles ? 'implemented' : hasSubtitles ? 'implemented' : 'missing'}`)
    }
  }

  ok(
    `${manifest.id}@${manifest.version}  [${[hasSources && 'streaming', hasSubtitles && 'subtitles'].filter(Boolean).join('+')}]  ${where}`,
  )
}

/* ------------------------------------------------------------------ */
/* B. Runtime contract parity (mobile sandbox vs web iframe bootstrap) */
/* ------------------------------------------------------------------ */

const mobileBootstrap = readFileSync(join(root, 'src/platform/quickjs/bootstrap.ts'), 'utf8')
const webBootstrap = readFileSync(join(webRoot, 'src/extensions/runtime/bootstrap.ts'), 'utf8')

/** Every stable error code either bootstrap can produce. */
function codesOf(text) {
  return new Set([...text.matchAll(/'(VALIDATION_FAILED|EXTENSION_ERROR|EXTENSION_TIMEOUT|EXTENSION_NOT_FOUND|INVALID_RESULT|API_VERSION_UNSUPPORTED|HTTP_ERROR|HTTP_TIMEOUT|PIXICLIENT_UNAVAILABLE|PIXICLIENT_ERROR)'/g)].map((m) => m[1]))
}

/** `code: 'X'` … `message: '…'` — the shared envelope copy (either layout). */
function envelopeCopyOf(text) {
  const out = new Map()
  const objectPattern = /code:\s*'([A-Z_]+)',\s*message:\s*'((?:[^'\\]|\\.)*)'/g
  for (const match of text.matchAll(objectPattern)) {
    out.set(match[2], match[1])
  }
  const extErrPattern = /extErr\(\s*'([A-Z_]+)',\s*'((?:[^'\\]|\\.)*)'\s*\)/g
  for (const match of text.matchAll(extErrPattern)) {
    out.set(match[2], match[1])
  }
  return out
}

const webCodes = codesOf(webBootstrap)
const mobileCodes = codesOf(mobileBootstrap)
for (const code of mobileCodes) {
  if (!webCodes.has(code)) {
    fail('bootstrap', `mobile sandbox uses error code "${code}" that the web bootstrap never produces`)
  }
}
ok(`error codes: mobile ${[...mobileCodes].sort().join(', ')}`)

const webCopy = envelopeCopyOf(webBootstrap)
const mobileCopy = envelopeCopyOf(mobileBootstrap)
let sharedChecked = 0
for (const [literal, mobileCode] of mobileCopy) {
  if (!webCopy.has(literal)) continue // mobile-only message, not part of the contract
  sharedChecked += 1
  if (webCopy.get(literal) !== mobileCode) {
    fail(
      'bootstrap',
      `message "${literal}" maps to ${mobileCode} on mobile but ${webCopy.get(literal)} on the web`,
    )
  }
}
if (sharedChecked === 0) fail('bootstrap', 'no shared envelope copy was found in either bootstrap')
ok(`shared bootstrap messages checked: ${sharedChecked}`)

/** The API version an extension asks for must mean the same thing on both. */
const webSdkTypes = readFileSync(join(webRoot, 'src/extensions/sdk/types.ts'), 'utf8')
const mobileSdkTypes = readFileSync(join(root, 'src/extensions/sdk/types.ts'), 'utf8')
if (webSdkTypes !== mobileSdkTypes) {
  fail('sdk', 'src/extensions/sdk/types.ts differs between the web and mobile projects')
}
if (!webSdkTypes.includes(`EXTENSION_API_VERSION = '${EXTENSION_API_VERSION}'`)) {
  fail('sdk', 'sdk types do not declare the API version the compat check read')
}
ok(`extension API version: ${EXTENSION_API_VERSION} (sdk/types.ts identical on both)`)

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

for (const note of notes) console.log(`  · ${note}`)

if (failures.length > 0) {
  console.error('\nExtension compatibility check FAILED:')
  for (const failure of failures) console.error(`  ✘ ${failure}`)
  process.exit(1)
}

console.log(`\nOK — ${files.length} extension(s) compatible, contract parity holds.`)
