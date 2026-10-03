/**
 * ExtensionRuntime — sandbox pool + isolated per-extension calls.
 *
 * Isolation guarantees (spec §27):
 *  - every call is wrapped: one extension failing never throws into the
 *    aggregator — it becomes a structured per-provider outcome;
 *  - timeouts are enforced host-side and recycle the sandbox frame;
 *  - registry changes (disable/remove/update) dispose idle sandboxes, so a
 *    disabled extension can never make requests again.
 */
import { EXEC_TIMEOUT_MS } from './config.ts'
import { ExtensionSandbox } from './ExtensionSandbox.ts'
import { extensionRequest } from './http.ts'
import { selectEnabled, useExtensionRegistry, type ExtensionRecord } from './ExtensionRegistry.ts'

const pool = new Map<string, ExtensionSandbox>()
let hydrateInFlight: Promise<void> | null = null

/** Load installed records from storage (idempotent). */
export function ensureExtensionsHydrated(): Promise<void> {
  if (!hydrateInFlight) hydrateInFlight = useExtensionRegistry.getState().hydrate()
  return hydrateInFlight
}

function sandboxFor(record: ExtensionRecord): ExtensionSandbox {
  const existing = pool.get(record.id)
  if (existing && !existing.isDisposed) return existing
  const fresh = new ExtensionSandbox(record.source, record.id, extensionRequest, () => {
    pool.delete(record.id)
  })
  pool.set(record.id, fresh)
  return fresh
}

/** Tear down sandboxes whose records were disabled, removed or replaced. */
useExtensionRegistry.subscribe((state, prev) => {
  const prevById = new Map(prev.records.map((r) => [r.id, r] as const))
  const stateIds = new Set(state.records.map((r) => r.id))

  for (const id of [...pool.keys()]) {
    const before = prevById.get(id)
    const after = state.records.find((r) => r.id === id)
    const removed = !stateIds.has(id)
    const disabled = Boolean(before && after && before.enabled && !after.enabled)
    const replaced = Boolean(before && after && before.source !== after.source)
    if (removed || disabled || replaced) pool.get(id)?.dispose()
  }
})

/** Run one method on one extension under the standard deadline. */
export async function callExtension(
  record: ExtensionRecord,
  method: 'getSources' | 'getSubtitles',
  args: unknown,
  timeoutMs: number = EXEC_TIMEOUT_MS,
): Promise<unknown> {
  return sandboxFor(record).call(method, args, timeoutMs)
}

/** Enabled extensions offering a capability (after hydration). */
export async function enabledExtensions(
  capability: 'streaming' | 'subtitles',
  extra?: (record: ExtensionRecord) => boolean,
): Promise<ExtensionRecord[]> {
  await ensureExtensionsHydrated()
  const records = selectEnabled(useExtensionRegistry.getState().records, capability)
  return extra ? records.filter(extra) : records
}

/** Drop every live sandbox (used by tests / storage resets). */
export function disposeAllSandboxes(): void {
  for (const id of [...pool.keys()]) pool.get(id)?.dispose()
  pool.clear()
}
