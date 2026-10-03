/**
 * i18n integrity tests (en is the source of truth).
 *
 * - `tr` must cover exactly the `en` key set (also compile-enforced via
 *   `typeof en`); `ru` must cover every `en` key and may only add Russian
 *   plural buckets (`_few`, `_many`) on top of `en` plural bases.
 * - Interpolation placeholders ({{var}}) must match across languages.
 * - `EXT_MESSAGE_KEYS` values must exist in `en` and be byte-identical to
 *   the English runtime message (keeps English e2e assertions green).
 * - Every static `t('…')` literal in src/ must resolve to an `en` key
 *   (plural bases like `foo` matching `foo_one`/`foo_other` are allowed).
 *
 * Anime API content (titles, synopses, genres…) is intentionally out of scope.
 * Run: pnpm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { en } from '../src/i18n/resources/en.ts'
import { tr } from '../src/i18n/resources/tr.ts'
import { ru } from '../src/i18n/resources/ru.ts'
import { EXT_MESSAGE_KEYS } from '../src/i18n/ext-messages.ts'

type Leaves = Record<string, string>

function flatten(value: unknown, prefix = '', out: Leaves = {}): Leaves {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  } else if (typeof value === 'string' && prefix) {
    out[prefix] = value
  }
  return out
}

const enL = flatten(en)
const trL = flatten(tr)
const ruL = flatten(ru)

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{\{\s*([a-zA-Z0-9_]+)(\s*,[^}]*)?\}\}/g)]
    .map((m) => m[1])
    .sort()
}

test('tr covers exactly the en key set', () => {
  const missing = Object.keys(enL).filter((key) => !(key in trL))
  const extra = Object.keys(trL).filter((key) => !(key in enL))
  assert.deepEqual(missing, [], `tr is missing keys: ${missing.join(', ')}`)
  assert.deepEqual(extra, [], `tr has unexpected keys: ${extra.join(', ')}`)
})

test('ru covers every en key; extras are only _few/_many plural buckets', () => {
  const enKeys = new Set(Object.keys(enL))
  const missing = [...enKeys].filter((key) => !(key in ruL))
  assert.deepEqual(missing, [], `ru is missing keys: ${missing.join(', ')}`)

  for (const key of Object.keys(ruL)) {
    if (enKeys.has(key)) continue
    const match = key.match(/^(.*)_(few|many)$/)
    assert.ok(match, `ru has an unexpected extra key: ${key}`)
    const base = match[1]
    assert.ok(
      `${base}_one` in enL || `${base}_other` in enL,
      `ru plural bucket ${key} has no matching en plural base`,
    )
  }
})

test('interpolation placeholders match across en/tr/ru', () => {
  for (const [lang, dict] of [
    ['tr', trL],
    ['ru', ruL],
  ] as const) {
    for (const [key, enMessage] of Object.entries(enL)) {
      const other = key in dict ? dict[key] : undefined
      if (other === undefined) continue // ru plural extras are checked above
      assert.deepEqual(
        placeholders(other),
        placeholders(enMessage),
        `placeholder mismatch for ${key} (${lang}): "${other}" vs "${enMessage}"`,
      )
    }
  }
})

test('EXT_MESSAGE_KEYS values exist in en and are byte-identical to en text', () => {
  for (const [message, key] of Object.entries(EXT_MESSAGE_KEYS)) {
    assert.ok(key in enL, `EXT_MESSAGE_KEYS points at a missing en key: ${key}`)
    assert.equal(
      enL[key],
      message,
      `en.${key} must be byte-identical to the runtime message (English e2e assertions depend on it)`,
    )
  }
})

test("every static t('…') literal in src resolves to an en key", () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url))
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
    }
  }
  walk(srcDir)

  const callPattern = /\bt\(\s*(['"`])([^'"`]+)\1/g
  const unknown: string[] = []
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(callPattern)) {
      const key = match[2]
      const resolved = key in enL || `${key}_one` in enL || `${key}_other` in enL
      if (!resolved) unknown.push(`${file.replace(srcDir, 'src')}: ${key}`)
    }
  }
  assert.deepEqual(unknown, [], `t() keys missing from en.ts:\n${unknown.join('\n')}`)
})
