/**
 * Composition of the scripts evaluated inside a QuickJS context.
 *
 * Two evaluations happen per extension boot, in this order:
 *
 *  1. **runtime script** (global) — `RUNTIME_JS`, a concatenation of
 *       a. the locale prelude (read by the bootstrap for `navigator.language`),
 *       b. the bundled WHATWG URL polyfill (QuickJS ships no `URL`),
 *       c. the sandbox bootstrap: denies every network primitive, wires
 *          `console` to the host, and defines `__pixiBoot` / `__pixiCall` /
 *          `__pixiTakeBoot` / `__pixiTakeOutcome` / `__pixiHttpResult`.
 *  2. **entry script** (ES module) — `ENTRY_JS`, which imports the extension
 *     through the engine's module loader and hands it to `__pixiBoot`.
 *
 * The extension source itself is never interpolated into either string; the
 * loader serves it verbatim as the `pixi:extension` module.
 *
 * The static part is built once — it is ~35 KB and never changes.
 */
import { URL_POLYFILL } from './generated/urlPolyfill'
import { SANDBOX_BOOTSTRAP, SANDBOX_ENTRY } from './bootstrap'

const STATIC_RUNTIME = `${URL_POLYFILL}\n${SANDBOX_BOOTSTRAP}`

/**
 * Device language for `navigator.language` inside the sandbox.
 *
 * Hermes exposes Intl (bundled since RN 0.73); falling back to `en` keeps
 * this working even if a build strips it.
 */
function deviceLocale(): string {
  try {
    const resolved = new Intl.DateTimeFormat().resolvedOptions().locale
    if (typeof resolved === 'string' && resolved.length > 0) return resolved
  } catch {
    /* Intl unavailable */
  }
  return 'en'
}

/** The global script evaluated before the extension module is imported. */
export function buildRuntimeScript(): string {
  return `globalThis.__pixiLocale = ${JSON.stringify(deviceLocale())};\n${STATIC_RUNTIME}`
}

/** The ES module that imports the extension and boots it. */
export function buildEntryScript(): string {
  return SANDBOX_ENTRY
}
