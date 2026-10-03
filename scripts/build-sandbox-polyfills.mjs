#!/usr/bin/env node
/**
 * Generates `src/platform/quickjs/generated/urlPolyfill.ts`.
 *
 * QuickJS ships neither `URL` nor `URLSearchParams`, and every extension in
 * the wild builds request URLs with them. Rather than hand-rolling a parser
 * (URL parsing is a spec with hundreds of edge cases) we bundle the SAME
 * WHATWG implementation the app itself uses (`react-native-url-polyfill`)
 * into a self-contained IIFE that installs `globalThis.URL` /
 * `globalThis.URLSearchParams` inside the sandbox.
 *
 * Sharing one implementation means the host's `policy.buildTargetUrl()` and
 * the sandbox's `context.utils.withQuery()` can never disagree about URL
 * semantics.
 *
 * The bundle is a string literal — it is evaluated as part of the sandbox
 * bootstrap, never imported as a module, so Metro never sees it. `react-native`
 * is stubbed out: the polyfill only reads `NativeModules`, which it does not
 * actually use at runtime.
 *
 * Usage:
 *   node scripts/build-sandbox-polyfills.mjs           # write
 *   node scripts/build-sandbox-polyfills.mjs --check   # fail on drift
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

import esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, 'src/platform/quickjs/generated/urlPolyfill.ts')
const checkOnly = process.argv.includes('--check')

/** Satisfies the polyfill's `import { NativeModules } from 'react-native'`. */
const reactNativeStub = {
  name: 'react-native-stub',
  setup(build) {
    build.onResolve({ filter: /^react-native$/ }, () => ({
      path: 'react-native',
      namespace: 'react-native-stub',
    }))
    build.onLoad({ filter: /.*/, namespace: 'react-native-stub' }, () => ({
      loader: 'js',
      contents: [
        'export const NativeModules = {};',
        'export const Platform = { OS: "android", select: (o) => ("android" in o ? o.android : o.default) };',
      ].join('\n'),
    }))
  },
}

const entry = `
import { URL, URLSearchParams } from 'react-native-url-polyfill'
globalThis.URL = URL
globalThis.URLSearchParams = URLSearchParams
globalThis.__PIXI_URL_POLYFILL__ = true
`

const result = await esbuild.build({
  stdin: { contents: entry, loader: 'js', resolveDir: root, sourcefile: 'urlPolyfill.entry.js' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  charset: 'ascii',
  minify: false,
  plugins: [reactNativeStub],
  write: false,
  logLevel: 'warning',
})

const code = result.outputFiles[0].text.trim()

// Hard guarantees about what may run inside QuickJS. There is no CommonJS,
// and none of these platform globals exist in the engine. (Word boundaries
// matter — `ArrayBuffer` is fine, `Buffer` is not.)
for (const [label, pattern] of [
  ['require(', /\brequire\s*\(/],
  ['TextEncoder', /\bTextEncoder\b/],
  ['TextDecoder', /\bTextDecoder\b/],
  ['Buffer', /\bBuffer\b/],
  ['process', /\bprocess\b/],
  ['global', /\bglobal\b/],
]) {
  if (pattern.test(code)) {
    console.error(
      `urlPolyfill: bundled code references "${label}", which does not exist inside QuickJS.`,
    )
    process.exit(1)
  }
}
if (!code.includes('__PIXI_URL_POLYFILL__')) {
  console.error('urlPolyfill: bundle did not install the globals — entry changed?')
  process.exit(1)
}

const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/build-sandbox-polyfills.mjs\` from
 * react-native-url-polyfill (MIT). Evaluated as a plain script as the first
 * stage of the QuickJS sandbox bootstrap, before any extension code runs —
 * the same URL implementation the app uses on the host side.
 */

export const URL_POLYFILL = ${JSON.stringify(code)}
`

mkdirSync(dirname(outFile), { recursive: true })

let existing = ''
try {
  existing = readFileSync(outFile, 'utf8')
} catch {
  /* first run */
}
if (existing === header) {
  console.log('OK — urlPolyfill.ts is up to date')
  process.exit(0)
}

if (checkOnly) {
  console.error('urlPolyfill.ts is out of date — run: npm run polyfills')
  process.exit(1)
}

writeFileSync(outFile, header)
console.log(`Wrote ${outFile.replace(root + '/', '')} (${code.length} bytes)`)
