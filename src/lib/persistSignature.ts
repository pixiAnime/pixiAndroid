/**
 * Signature of what the query cache would persist.
 *
 * The debounced writer in `src/lib/queryClient.ts` serialises the whole
 * dehydrated cache — up to `PERSIST_MAX_CHARS`, i.e. megabytes of
 * `JSON.stringify` followed by an equally large MMKV write — on *every* query
 * cache event. Most of those events change nothing the payload carries:
 * an observer re-rendering, a background refetch starting or stopping, a
 * query being added in the `pending` state. This module answers "would the
 * payload differ?" for the cost of a string join, so the writer can skip them.
 *
 * Deliberately pure (a plain array in, a string out) so it is testable under
 * `node --test` without a renderer, a QueryClient or MMKV — the same reason
 * `deriveConnectionStatus` lives outside its hook.
 *
 * Fields mirror what `dehydrate` emits for a successful query: the identity of
 * the entry, whether it is in a persistable state, and when/how often its data
 * changed. Anything else in the state (fetch status, error text, structural
 * sharing nodes) does not alter the payload.
 */
export interface PersistEntry {
  /** `query.queryHash` — the entry's key inside the dehydrated array. */
  queryHash: string
  /** `query.state.status` — only `success` queries are dehydrated. */
  status: string
  /** `query.state.dataUpdatedAt` — bumped on every successful fetch. */
  dataUpdatedAt: number
  /** `query.state.dataUpdateCount` — distinguishes a re-fetch of equal data. */
  dataUpdateCount: number
}

/**
 * Stable fingerprint of the persistable cache. Two caches that would serialise
 * to the same set of entries produce the same string, in any order.
 */
export function persistSignature(entries: readonly PersistEntry[]): string {
  let out = String(entries.length)
  for (const entry of entries) {
    out += `|${entry.queryHash}:${entry.status}:${entry.dataUpdatedAt}:${entry.dataUpdateCount}`
  }
  return out
}
