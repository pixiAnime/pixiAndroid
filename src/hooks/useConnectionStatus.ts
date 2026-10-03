/**
 * `useConnectionStatus` — the live signal behind the status indicator.
 *
 * Mobile-owned (not part of the synced core). It reads only state the app
 * already has — `onlineManager` and the react-query cache — and never issues a
 * request of its own. The precedence rules live in the pure
 * `deriveConnectionStatus` so they can be tested in isolation.
 */
import { useEffect, useMemo, useState } from 'react'
import { onlineManager, useIsFetching, useQueryClient } from '@tanstack/react-query'

import {
  deriveConnectionStatus,
  type ConnectionSignals,
  type ConnectionStatus,
} from '@/lib/connectionStatus'

export interface ConnectionStatusResult {
  status: ConnectionStatus
  signals: ConnectionSignals
}

/** True while any query in the cache is in an error state. */
function cacheHasError(queryClient: ReturnType<typeof useQueryClient>): boolean {
  return queryClient.getQueryCache().getAll().some((query) => query.state.status === 'error')
}

/** True once any query has resolved successfully. */
function cacheHasData(queryClient: ReturnType<typeof useQueryClient>): boolean {
  return queryClient.getQueryCache().getAll().some((query) => query.state.status === 'success')
}

export function useConnectionStatus(): ConnectionStatusResult {
  const queryClient = useQueryClient()
  const fetchingCount = useIsFetching()

  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline())
  const [isError, setIsError] = useState(() => cacheHasError(queryClient))
  const [hasData, setHasData] = useState(() => cacheHasData(queryClient))

  useEffect(() => onlineManager.subscribe((online) => setIsOnline(online)), [])

  useEffect(() => {
    const sync = () => {
      setIsError(cacheHasError(queryClient))
      setHasData(cacheHasData(queryClient))
    }
    sync()
    return queryClient.getQueryCache().subscribe(sync)
  }, [queryClient])

  const signals = useMemo<ConnectionSignals>(
    () => ({ isOnline, isFetching: fetchingCount > 0, isError, hasData }),
    [isOnline, fetchingCount, isError, hasData],
  )

  return { status: deriveConnectionStatus(signals), signals }
}
