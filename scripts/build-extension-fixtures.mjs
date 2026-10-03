#!/usr/bin/env node
/**
 * Generates `src/dev/fixtures/extensions.generated.ts` — a read-only snapshot
 * of the real extension corpus in `../pixiWeb/extensions/`.
 *
 * Why: the M0 spike runs unmodified production extensions inside the native
 * QuickJS sandbox on a device or emulator, where there is no filesystem and
 * no guarantee of connectivity. Bundling the fixtures makes that check
 * deterministic and offline. Nothing in `../pixiWeb` is ever written to.
 *
 * Usage:
 *   node scripts/build-extension-fixtures.mjs           # write
 *   node scripts/build-extension-fixtures.mjs --check   # fail on drift
 */
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = resolve(root, '..', 'pixiWeb')
const outFile = resolve(root, 'src/dev/fixtures/extensions.generated.ts')
const checkOnly = process.argv.includes('--check')

/** Extension files copied verbatim (source text must stay byte-identical). */
const FIXTURES = [
  'extensions/openani/openani.js',
  'extensions/ayruki-auto/ayruki-auto.js',
  'extensions/altyazi-arsivi/altyazi-arsivi.js',
  'extensions/examples/dist/demo-both.js',
  'extensions/examples/dist/demo-streaming.js',
  'extensions/examples/dist/demo-subtitles.js',
]

const entries = FIXTURES.map((path) => {
  const source = readFileSync(resolve(webRoot, path), 'utf8')
  const id = path.split('/').pop().replace(/\.js$/, '')
  return `  ${JSON.stringify(id)}: ${JSON.stringify(source)},`
})

const output = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/build-extension-fixtures.mjs\` from the real extension
 * corpus in \`../pixiWeb/extensions\`. Used ONLY by the dev-only sandbox spike
 * (\`src/dev/sandboxSpike.ts\`), which must be able to boot production
 * extensions without a network or a filesystem.
 */
export const EXTENSION_FIXTURES: Readonly<Record<string, string>> = {
${entries.join('\n')}
}
`

mkdirSync(dirname(outFile), { recursive: true })

let existing = ''
try {
  existing = readFileSync(outFile, 'utf8')
} catch {
  /* first run */
}

if (existing === output) {
  console.log(`OK — ${relative(root, outFile)} is up to date (${FIXTURES.length} fixtures)`)
  process.exit(0)
}

if (checkOnly) {
  console.error('extensions.generated.ts is out of date — run: npm run fixtures')
  process.exit(1)
}

writeFileSync(outFile, output)
console.log(`Wrote ${relative(root, outFile)} (${FIXTURES.length} fixtures, ${output.length} bytes)`)
