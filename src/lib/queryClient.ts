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
 */
import { AppState } from 'react-native'
import { QueryClient, dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { getLocalStorage } from '@/platform/storage/localStorage'

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
      shouldDehydrateQuery: (query) =>
        query.state.status === 'success' &&
        PERSISTED_QUERY_ROOTS.has(String(query.queryKey[0])),
    },
  },
})

function dropPersistedCache() {
  try {
    getLocalStorage().removeItem(QUERY_CACHE_STORAGE_KEY)
  } catch {
    /* storage unavailable — nothing to drop */
  }
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
  } catch {
    // Corrupt payload or storage disabled — start fresh.
    dropPersistedCache()
  }
}

/** Serialize + write, halving the query set (newest first) until it fits. */
function persistNow() {
  try {
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
// Don't lose the last debounce when the OS backgrounds the process.
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') persistNow()
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
