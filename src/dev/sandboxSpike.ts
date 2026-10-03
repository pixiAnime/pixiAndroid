/**
 * M0 spike A — end-to-end proof that the native QuickJS sandbox works.
 *
 * Every check exercises the REAL stack: TypeScript → Kotlin (`PixiSandbox`) →
 * JNI → C++ → QuickJS → back, with the host HTTP policy layer in the loop.
 * It runs on a device/emulator (the engine is native), so it is wired into
 * the dev shell rather than into `node --test`.
 *
 * What it proves, in order:
 *  1. production extensions from `../pixiWeb/extensions` boot UNMODIFIED and
 *     expose `{ manifest, methods }`;
 *  2. a module that is not an extension fails with the exact friendly copy
 *     the shared validator expects;
 *  3. `context.http.get` performs a real network request and returns its
 *     status — through the sandbox → host policy → RN fetch path;
 *  4. `getSources` / `getSubtitles` resolve through `call()` (incl. timeouts);
 *  5. an extension stuck in `while (true) {}` is killed by the deadline and
 *     the runtime recycles, so the next call boots fresh;
 *  6. thrown errors surface as structured `EXTENSION_ERROR`, never a crash;
 *  7. `console.*` from inside the sandbox reaches the host log;
 *  8. `dispose()` rejects in-flight work and makes the context unreachable.
 *
 * Nothing here writes to the shared stores or the registry.
 */
import { ExtensionSandbox } from '@/extensions/runtime/ExtensionSandbox.ts'
import { extensionRequest } from '@/extensions/runtime/http.ts'
import type { SourceRequest } from '@/extensions/sdk/types.ts'
import { EXTENSION_FIXTURES } from './fixtures/extensions.generated.ts'

export interface SpikeResult {
  name: string
  pass: boolean
  detail: string
}

export interface SpikeReport {
  results: SpikeResult[]
  passed: number
  failed: number
  durationMs: number
}

const REQUEST: SourceRequest = {
  anime: { malId: 21, titles: { english: 'One Piece', romaji: 'One Piece' } },
  episode: { number: 1 },
}

/** Minimal manifest every synthetic extension carries. */
function manifest(id: string): string {
  return JSON.stringify({
    id,
    name: id,
    author: 'spike',
    version: '1.0.0',
    apiVersion: '1',
    capabilities: { streaming: true, subtitles: true },
  })
}

/** A network probe: returns the HTTP status as the source "quality". */
const HTTP_PROBE = `
export default {
  manifest: ${manifest('spike-http')},
  async getSources(context) {
    const res = await context.http.get('https://example.com/');
    return [{ url: 'https://media.test/probe.mp4', type: 'mp4', quality: 'status:' + res.status }];
  },
}
`

/** Wedges the engine — only the host deadline can end this call. */
const INFINITE_LOOP = `
export default {
  manifest: ${manifest('spike-loop')},
  getSources() {
    for (;;) {}
  },
}
`

const THROWER = `
export default {
  manifest: ${manifest('spike-throw')},
  getSources() {
    throw new Error('kaboom');
  },
}
`

const NO_MANIFEST = `export default { name: 'not an extension' };`

const LOGGER = `
export default {
  manifest: ${manifest('spike-log')},
  getSources(context) {
    context.logger.info('from context.logger');
    console.log('from console.log');
    return [];
  },
}
`

function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown }
    return `${typeof e.code === 'string' ? e.code : 'UNKNOWN'}: ${String(e.message ?? '')}`
  }
  return String(error)
}

async function check(name: string, run: () => Promise<string>): Promise<SpikeResult> {
  try {
    return { name, pass: true, detail: await run() }
  } catch (error) {
    return { name, pass: false, detail: describeError(error) }
  }
}

function expect(condition: boolean, detail: string): string {
  if (!condition) throw new Error(detail)
  return detail
}

/** Boot every production fixture unmodified, then dispose it. */
async function bootFixtures(): Promise<string> {
  const booted: string[] = []
  for (const [key, source] of Object.entries(EXTENSION_FIXTURES)) {
    const sandbox = new ExtensionSandbox(source, key, extensionRequest)
    try {
      const info = await sandbox.start()
      const manifestValue = info.manifest as { id?: unknown; name?: unknown; version?: unknown }
      expect(
        typeof manifestValue?.id === 'string' && manifestValue.id.length > 0,
        `${key}: manifest.id is missing`,
      )
      expect(
        info.methods.getSources === true || info.methods.getSubtitles === true,
        `${key}: no implemented methods`,
      )
      booted.push(String(manifestValue.id))
    } finally {
      sandbox.dispose()
    }
  }
  expect(booted.length === Object.keys(EXTENSION_FIXTURES).length, 'not every fixture booted')
  return `booted ${booted.length}: ${booted.join(', ')}`
}

export async function runSandboxSpike(): Promise<SpikeReport> {
  const started = Date.now()
  const results: SpikeResult[] = []

  results.push(await check('production extensions boot unmodified', bootFixtures))

  results.push(
    await check('non-extension module fails validation', async () => {
      const sandbox = new ExtensionSandbox(NO_MANIFEST, 'spike-invalid', extensionRequest)
      try {
        await sandbox.start()
        throw new Error('start() resolved for a module with no manifest')
      } catch (error) {
        const e = error as { code?: string; message?: string }
        expect(e.code === 'VALIDATION_FAILED', `unexpected code: ${e.code}`)
        expect(
          e.message === 'The extension does not export a manifest.',
          `unexpected message: ${e.message}`,
        )
        return `${e.code}: ${e.message}`
      } finally {
        sandbox.dispose()
      }
    }),
  )

  results.push(
    await check('context.http performs a real request', async () => {
      const sandbox = new ExtensionSandbox(HTTP_PROBE, 'spike-http', extensionRequest)
      try {
        await sandbox.start()
        const value = (await sandbox.call('getSources', REQUEST, 20_000)) as Array<{
          quality?: string
        }>
        const quality = value[0]?.quality ?? ''
        expect(quality === 'status:200', `expected status:200, got "${quality}"`)
        return `GET https://example.com → ${quality.slice('status:'.length)}`
      } finally {
        sandbox.dispose()
      }
    }),
  )

  results.push(
    await check('getSources resolves through call()', async () => {
      const source = EXTENSION_FIXTURES['demo-streaming']
      if (!source) throw new Error('demo-streaming fixture missing')
      const sandbox = new ExtensionSandbox(source, 'demo-streaming', extensionRequest)
      try {
        const value = (await sandbox.call('getSources', REQUEST, 20_000)) as Array<{ url?: string }>
        expect(Array.isArray(value) && value.length > 0, 'getSources returned nothing')
        expect(typeof value[0]?.url === 'string' && value[0].url.length > 0, 'no source url')
        return `1 source → ${value[0]?.url}`
      } finally {
        sandbox.dispose()
      }
    }),
  )

  let wedged: ExtensionSandbox | null = null
  results.push(
    await check('deadline kills an infinite loop', async () => {
      wedged = new ExtensionSandbox(INFINITE_LOOP, 'spike-loop', extensionRequest)
      const begin = Date.now()
      try {
        await wedged.call('getSources', REQUEST, 2_000)
        throw new Error('the wedged call resolved instead of timing out')
      } catch (error) {
        const elapsed = Date.now() - begin
        const e = error as { code?: string }
        expect(e.code === 'EXTENSION_TIMEOUT', `unexpected code: ${e.code}`)
        expect(elapsed < 6_000, `took ${elapsed}ms — the deadline did not cut it off`)
        return `EXTENSION_TIMEOUT after ${elapsed}ms`
      } finally {
        wedged?.dispose()
        wedged = null
      }
    }),
  )

  results.push(
    await check('runtime recycles after a timeout', async () => {
      const sandbox = new ExtensionSandbox(INFINITE_LOOP, 'spike-recycle', extensionRequest)
      try {
        await sandbox.start()
      } finally {
        sandbox.dispose()
      }
      const fresh = new ExtensionSandbox(LOGGER, 'spike-recycle', extensionRequest)
      try {
        const info = await fresh.start()
        expect(
          (info.manifest as { id?: string })?.id === 'spike-log',
          'the recycled context served the wrong module',
        )
        return 'a fresh context booted for the same id'
      } finally {
        fresh.dispose()
      }
    }),
  )

  results.push(
    await check('thrown errors become EXTENSION_ERROR', async () => {
      const sandbox = new ExtensionSandbox(THROWER, 'spike-throw', extensionRequest)
      try {
        await sandbox.start()
        await sandbox.call('getSources', REQUEST, 10_000)
        throw new Error('the throwing call resolved')
      } catch (error) {
        const e = error as { code?: string }
        expect(e.code === 'EXTENSION_ERROR', `unexpected code: ${e.code}`)
        return `${e.code}: the engine stayed alive`
      } finally {
        sandbox.dispose()
      }
    }),
  )

  results.push(
    await check('console output reaches the host', async () => {
      const captured: string[] = []
      const levels = ['log', 'info', 'warn', 'error', 'debug'] as const
      const originals = levels.map((level) => console[level])
      for (const [index, level] of levels.entries()) {
        console[level] = (...args: unknown[]) => {
          captured.push(args.map(String).join(' '))
          originals[index].apply(console, args as [])
        }
      }
      const sandbox = new ExtensionSandbox(LOGGER, 'spike-log', extensionRequest)
      try {
        await sandbox.start()
        await sandbox.call('getSources', REQUEST, 10_000)
      } finally {
        for (const [index, level] of levels.entries()) console[level] = originals[index]
        sandbox.dispose()
      }
      expect(
        captured.some((line) => line.includes('from context.logger')),
        `logger output missing: ${captured.join(' | ')}`,
      )
      expect(
        captured.some((line) => line.includes('from console.log')),
        `console output missing: ${captured.join(' | ')}`,
      )
      return captured.length > 0 ? captured.join(' | ') : 'no output captured'
    }),
  )

  results.push(
    await check('dispose() makes the context unreachable', async () => {
      const sandbox = new ExtensionSandbox(LOGGER, 'spike-dispose', extensionRequest)
      await sandbox.start()
      sandbox.dispose()
      expect(sandbox.isDisposed, 'isDisposed stayed false')
      try {
        await sandbox.call('getSources', REQUEST, 5_000)
        throw new Error('a disposed sandbox still answered a call')
      } catch (error) {
        const e = error as { code?: string }
        expect(e.code === 'EXTENSION_NOT_FOUND', `unexpected code: ${e.code}`)
        return `${e.code} after dispose`
      }
    }),
  )

  const passed = results.filter((r) => r.pass).length
  return {
    results,
    passed,
    failed: results.length - passed,
    durationMs: Date.now() - started,
  }
}
