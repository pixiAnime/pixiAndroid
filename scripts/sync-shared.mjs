#!/usr/bin/env node
/**
 * sync-shared — pull the platform-independent core from ../pixiWeb.
 *
 *   node scripts/sync-shared.mjs          copy (default)
 *   node scripts/sync-shared.mjs --check  verify only, exit 1 on drift
 *
 * Two modes are supported (see shared-manifest.json):
 *   verbatim      byte-identical copy of the web source
 *   transformed   copy after a named, documented transform
 *                 ("vite-dev": import.meta.env.* → RN globals)
 *
 * The output tree MIRRORS the web tree, so `@/*` imports keep working
 * unchanged in both projects. Never edit a generated file by hand —
 * change the web source (or move the path to the owned list) instead.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const manifest = JSON.parse(readFileSync(join(root, 'shared-manifest.json'), 'utf8'))
const webRoot = resolve(root, manifest.source)

if (!existsSync(join(webRoot, 'src'))) {
  console.error(`sync-shared: web source not found at ${webRoot}`)
  process.exit(2)
}

/** Apply a named transform; throws on anything it does not understand. */
function applyTransform(content, name, file) {
  const transform = manifest.transforms[name]
  if (!transform) {
    console.error(`sync-shared: unknown transform "${name}" (${file})`)
    process.exit(2)
  }
  let out = content
  for (const { from, to } of transform.substitutions) out = out.split(from).join(to)
  if (out.includes('import.meta')) {
    const line = out.split('\n').findIndex((l) => l.includes('import.meta')) + 1
    console.error(`sync-shared: unresolved import.meta in ${file}:${line} — extend the transform`)
    process.exit(2)
  }
  return out
}

const entries = [
  ...manifest.verbatim.map((path) => ({ path, with: null })),
  ...manifest.transformed,
]

/** Minimal diff summary: first/last differing line + a context window. */
function diffSummary(before, after) {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length - 1
  let endB = b.length - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--
    endB--
  }
  const from = Math.max(0, start - 2)
  const lines = [
    `  line ${start + 1}:`,
    ...a.slice(from, endA + 1).map((l) => `  - ${l}`),
    ...b.slice(from, endB + 1).map((l) => `  + ${l}`),
  ]
  return lines.slice(0, 40).join('\n')
}

const problems = []
let copied = 0
let unchanged = 0

for (const { path, with: transform } of entries) {
  const sourcePath = join(webRoot, path)
  if (!existsSync(sourcePath)) {
    problems.push(`missing in web source: ${path}`)
    continue
  }
  let expected = readFileSync(sourcePath, 'utf8')
  if (transform) expected = applyTransform(expected, transform, path)

  const destPath = join(root, path)
  const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : null

  if (current === expected) {
    unchanged++
    continue
  }
  if (check) {
    problems.push(
      `drift: ${path}\n` +
        (current === null ? '  (not synced yet)' : diffSummary(current, expected)),
    )
    continue
  }
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, expected)
  copied++
}

if (problems.length > 0) {
  console.error(`sync-shared: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(check ? '\nrun `npm run sync` to refresh shared files' : '')
  process.exit(1)
}

console.log(
  check
    ? `sync-shared: OK — ${entries.length} shared file(s) in sync with pixiWeb`
    : `sync-shared: ${copied} updated, ${unchanged} unchanged (${entries.length} shared)`,
)
