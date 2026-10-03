/**
 * Subtitle provider aggregator (spec §15/§16).
 *
 * Subtitle extensions are queried independently of streaming ones — a
 * completely different provider may supply the tracks. One failing provider
 * never breaks the merge; results are deduped across providers.
 */
import type { SubtitleRequest } from '../sdk/types.ts'
import type { StructuredExtensionError } from '../sdk/types.ts'
import { SUBTITLE_TIMEOUT_MS } from '../runtime/config.ts'
import { toStructuredExtensionError } from '../runtime/errors.ts'
import { callExtension, enabledExtensions } from '../runtime/ExtensionRuntime.ts'
import type { ExtensionRecord } from '../runtime/ExtensionRegistry.ts'
import { mergeSubtitles, normalizeSubtitles, type FlatSubtitle, type ProviderMeta } from './normalize.ts'

export interface SubtitleOutcome {
  extensionId: string
  extensionName: string
  subtitles: FlatSubtitle[]
  error?: StructuredExtensionError
}

export interface SubtitlesResult {
  /** Deduped (by URL) + sorted (language → label → provider). */
  subtitles: FlatSubtitle[]
  outcomes: SubtitleOutcome[]
  attempted: number
}

function meta(record: ExtensionRecord): ProviderMeta {
  return { id: record.id, name: record.manifest.name || record.id }
}

async function callProvider(
  record: ExtensionRecord,
  request: SubtitleRequest,
  timeoutMs: number,
): Promise<SubtitleOutcome> {
  const provider = meta(record)
  const outcome: SubtitleOutcome = {
    extensionId: provider.id,
    extensionName: provider.name,
    subtitles: [],
  }
  try {
    const raw = await callExtension(record, 'getSubtitles', request, timeoutMs)
    const { items, invalid } = normalizeSubtitles(raw, provider)
    if (invalid > 0 && items.length === 0) {
      const err = new Error('All subtitles returned by the extension were invalid.')
      ;(err as Error & { code?: string }).code = 'INVALID_RESULT'
      throw err
    }
    if ((__DEV__)) {
      console.debug(`[ext:${provider.id}] getSubtitles → ${items.length}${invalid ? ` (${invalid} invalid dropped)` : ''}`)
    }
    outcome.subtitles = items
    return outcome
  } catch (err) {
    const structured = toStructuredExtensionError(err, provider.id)
    if ((__DEV__)) {
      console.debug(`[ext:${provider.id}] getSubtitles failed: ${structured.code}`)
    }
    outcome.error = structured
    return outcome
  }
}

export async function collectSubtitles(
  request: SubtitleRequest,
  options: { timeoutMs?: number } = {},
): Promise<SubtitlesResult> {
  const records = await enabledExtensions('subtitles', (r) => r.methods.getSubtitles)
  const timeout = options.timeoutMs ?? SUBTITLE_TIMEOUT_MS

  const outcomes = await Promise.all(records.map((record) => callProvider(record, request, timeout)))
  const groups = outcomes.map((outcome) => outcome.subtitles)

  return {
    subtitles: mergeSubtitles(groups),
    outcomes,
    attempted: records.length,
  }
}
