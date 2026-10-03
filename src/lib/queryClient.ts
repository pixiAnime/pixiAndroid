/**
 * TanStack Query client — one place for caching, retry policy & persistence.
 *
 * The cache covers BOTH API sources (Jikan + AniList): it sits above the
 * `withFallback` endpoint layer and the query keys are source-agnostic, so
 * whichever source answered is what gets reused — switching sources (breaker
 * opening/closing) never invalidates anything.
 *
 * Two layers:
 * 1. In-memory — navigation within a screen reuses fresh results (staleTime).
 * 2. `localStorage` (MMKV-backed on Android) — successful API queries are
 *    rehydrated synchronously at module load (before the first render), so a
 *    cold start paints cached content instantly and revalidates in the
 *    background. Payloads older than a day or over the size budget are
 *    dropped instead of restored.
 *
 * Where the web build flushes the last debounced write on `pagehide`, this
 * build listens to React Native's `AppState` instead — the OS can suspend
 * the process without ever hiding a "window".
 *
 * Writes are gated by `persistSignature`: the debounce fires on every cache
 * event, but a payload identical to what is already on disk is skipped
 * instead of costing a full `dehydrate` + `JSON.stringify` + MMKV write.
 */
import { AppState } from 'react-native'
import {
  QueryClient,
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
} from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { getLocalStorage } from '@/platform/storage/localStorage'
import { persistSignature, type PersistEntry } from '@/lib/persistSignature'

/**
 * Retry policy: ALL retrying lives in the API clients (bounded ladders with
 * real backoff — Jikan: 429 → 2s, 5xx/network → 1s, max 2 attempts, then
 * the AniList fallback; AniList: similar 2-attempt ladder). React Query must
 * NOT retry on top of that — double retry amplifies rate-limit pressure and
 * keeps pages in limbo for ~30s. One exception: a bare network failure that
 * already exhausted the client ladder gets a single second chance after a
 * long pause (connectivity may have returned).
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  if (error instanceof ApiError && error.kind === 'aborted') return false
  return error instanceof ApiError && error.kind === 'network'
}

/* ------------------------- localStorage persistence ------------------------ */

/** Versioned storage key — bump the suffix to invalidate old payloads. */
export const QUERY_CACHE_STORAGE_KEY = 'pixiweb.query-cache.v1'
/** Never resurrect data older than this — start clean instead. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60_000
/** Stay well under a sane per-key budget. */
const PERSIST_MAX_CHARS = 1_500_000
/** Trailing debounce — one write per burst of query results. */
const PERSIST_DEBOUNCE_MS = 1_000
/** Query-key roots worth persisting (jikanKeys.*, episodeQueryKey, ids, stream). */
const PERSISTED_QUERY_ROOTS = new Set(['jikan', 'episodes', 'ids', 'stream'])

/**
 * Signature of the payload last written (or restored from storage).
 *
 * Every query-cache event schedules a debounced write, but most events change
 * nothing the payload carries — an observer re-rendering, a background refetch
 * starting, a query being added in `pending`. Without this the writer would
 * `dehydrate` + `JSON.stringify` (up to PERSIST_MAX_CHARS) and rewrite the
 * whole MMKV key for those, which is a visible hitch on the JS thread right
 * after scrolling settles. See `src/lib/persistSignature.ts`.
 */
let lastSignature = persistSignature([])

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // metadata barely changes — avoid repeat Jikan calls
      gcTime: 30 * 60_000,
      retry: shouldRetry,
      retryDelay: () => 5_000, // single, long pause — never stampede
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    dehydrate: {
      // Only complete API data — never persist errors or in-flight states.
      shouldDehydrateQuery: shouldPersistQuery,
    },
  },
})

/**
 * The one predicate behind persistence: `dehydrate` and the write gate must
 * agree, or the gate would compare against a different set than the payload.
 */
function shouldPersistQuery(query: Query): boolean {
  return (
    query.state.status === 'success' && PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0]))
  )
}

/** Exactly the entries `dehydrate` would emit — for `persistSignature`. */
function persistableEntries(): PersistEntry[] {
  const out: PersistEntry[] = []
  for (const query of queryClient.getQueryCache().getAll()) {
    if (!shouldPersistQuery(query)) continue
    out.push({
      queryHash: query.queryHash,
      status: query.state.status,
      dataUpdatedAt: query.state.dataUpdatedAt ?? 0,
      dataUpdateCount: query.state.dataUpdateCount,
    })
  }
  return out
}

function dropPersistedCache() {
  try {
    getLocalStorage().removeItem(QUERY_CACHE_STORAGE_KEY)
  } catch {
    /* storage unavailable — nothing to drop */
  }
  // Nothing on disk: the next write must not be skipped as "unchanged".
  lastSignature = persistSignature([])
}

/** Rehydrate synchronously — runs at import time, before the first render. */
function restorePersistedCache() {
  try {
    const raw = getLocalStorage().getItem(QUERY_CACHE_STORAGE_KEY)
    if (!raw) return
    const envelope = JSON.parse(raw) as { v?: number; savedAt?: number; state?: DehydratedState }
    if (envelope.v !== 1 || !envelope.state) return dropPersistedCache()
    if (Date.now() - (envelope.savedAt ?? 0) > PERSIST_MAX_AGE_MS) {
      return dropPersistedCache()
    }
    hydrate(queryClient, envelope.state)
    // Disk already holds exactly this content — don't rewrite it on the first
    // cache event after boot.
    lastSignature = persistSignature(persistableEntries())
  } catch {
    // Corrupt payload or storage disabled — start fresh.
    dropPersistedCache()
  }
}

/** Serialize + write, halving the query set (newest first) until it fits. */
function persistNow(force = false) {
  try {
    // Gate: if the payload would be identical to what is already on disk (the
    // common case — observer churn and fetch start/stop change nothing
    // dehydratable), skip the dehydrate/stringify/write entirely. `force`
    // (AppState → background) always writes, so `savedAt` keeps refreshing
    // inside PERSIST_MAX_AGE_MS.
    const signature = persistSignature(persistableEntries())
    if (!force && signature === lastSignature) return
    const wrap = (state: DehydratedState) =>
      JSON.stringify({ v: 1, savedAt: Date.now(), state })
    let state = dehydrate(queryClient)
    let raw = wrap(state)
    if (raw.length > PERSIST_MAX_CHARS) {
      const newest = [...state.queries].sort(
        (a, b) => (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0),
      )
      let keep = newest.length
      while (raw.length > PERSIST_MAX_CHARS && keep > 0) {
        keep = Math.floor(keep / 2)
        state = { ...state, queries: newest.slice(0, keep) }
        raw = wrap(state)
      }
    }
    getLocalStorage().setItem(QUERY_CACHE_STORAGE_KEY, raw)
    lastSignature = signature
  } catch {
    // Storage unavailable — the in-memory cache still works.
    dropPersistedCache()
  }
}

let persistTimer: ReturnType<typeof setTimeout> | undefined
function persistSoon() {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS)
}

// Restore BEFORE subscribing, so hydration doesn't trigger a pointless write.
restorePersistedCache()
queryClient.getQueryCache().subscribe(persistSoon)
// Don't lose the last debounce when the OS backgrounds the process — and
// write unconditionally there: it is the moment that refreshes `savedAt`.
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') persistNow(true)
})

/** Dev-only: trace query lifecycle (why a queryFn runs twice, cancels, retries). */
if (__DEV__) {
  queryClient.getQueryCache().subscribe((event) => {
    const key = JSON.stringify(event.query?.queryKey ?? '')
    if (!key.includes('"jikan"')) return
    const action = 'action' in event ? event.action.type : '-'
    console.debug(`[qc] ${event.type}/${action} ${key.slice(0, 100)}`)
  })
}
