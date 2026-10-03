/**
 * Streaming provider aggregator (spec §15/§16/§29).
 *
 * Fans out to every enabled streaming extension with allSettled semantics:
 * one provider crashing/timing out becomes a structured outcome while the
 * others still contribute sources. Never throws.
 */
import type { SourceRequest, StreamSource } from '../sdk/types.ts'
import { EXEC_TIMEOUT_MS } from '../runtime/config.ts'
import { toStructuredExtensionError, type ExtensionError } from '../runtime/errors.ts'
import { callExtension, enabledExtensions } from '../runtime/ExtensionRuntime.ts'
import type { ExtensionRecord } from '../runtime/ExtensionRegistry.ts'
import { normalizeSources, sortSources, type FlatSource, type ProviderMeta } from './normalize.ts'
import type { StructuredExtensionError } from '../sdk/types.ts'

export interface SourceOutcome {
  extensionId: string
  extensionName: string
  sources: FlatSource[]
  /** Present when this provider failed (others may have succeeded). */
  error?: StructuredExtensionError
}

export interface SourcesResult {
  /** Deduped + deterministically sorted across all providers. */
  sources: FlatSource[]
  outcomes: SourceOutcome[]
  /** How many enabled streaming extensions were asked. */
  attempted: number
}

function meta(record: ExtensionRecord): ProviderMeta {
  return { id: record.id, name: record.manifest.name || record.id }
}

async function callProvider(
  record: ExtensionRecord,
  request: SourceRequest,
  timeoutMs: number,
): Promise<SourceOutcome> {
  const provider = meta(record)
  const outcome: SourceOutcome = {
    extensionId: provider.id,
    extensionName: provider.name,
    sources: [],
  }
  try {
    const raw = await callExtension(record, 'getSources', request, timeoutMs)
    const { items, invalid } = normalizeSources(raw, provider)
    if (invalid > 0 && items.length === 0) {
      const err = new Error('All sources returned by the extension were invalid.')
      ;(err as Error & { code?: string }).code = 'INVALID_RESULT'
      throw err
    }
    if ((__DEV__)) {
      console.debug(`[ext:${provider.id}] getSources → ${items.length}${invalid ? ` (${invalid} invalid dropped)` : ''}`)
    }
    outcome.sources = items
    return outcome
  } catch (err) {
    const structured = toStructuredExtensionError(err as ExtensionError, provider.id)
    if ((__DEV__)) {
      console.debug(`[ext:${provider.id}] getSources failed: ${structured.code}`)
    }
    outcome.error = structured
    return outcome
  }
}

export async function collectSources(
  request: SourceRequest,
  options: { timeoutMs?: number } = {},
): Promise<SourcesResult> {
  const records = await enabledExtensions('streaming', (r) => r.methods.getSources)
  const timeout = options.timeoutMs ?? EXEC_TIMEOUT_MS

  const outcomes = await Promise.all(records.map((record) => callProvider(record, request, timeout)))

  const flattened: FlatSource[] = outcomes.flatMap((outcome) => outcome.sources)
  return {
    sources: sortSources(flattened),
    outcomes,
    attempted: records.length,
  }
}

export type { StreamSource }
