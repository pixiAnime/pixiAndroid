/**
 * App connection status.
 *
 * There is no bridge or server on Android (see README), so the status surface
 * is derived from what the app already knows: whether the device reports being
 * online, whether react-query currently has requests in flight, and whether any
 * query is in an error state. This module is intentionally pure so the
 * precedence rules can be unit-tested without a renderer.
 */

export type ConnectionStatus = 'running' | 'connecting' | 'error' | 'stopped'

export interface ConnectionSignals {
  /** `onlineManager.isOnline()` — false when the device is known to be offline. */
  isOnline: boolean
  /** At least one request is in flight. */
  isFetching: boolean
  /** At least one query is in an error state. */
  isError: boolean
  /** At least one query has resolved successfully. */
  hasData: boolean
}

/**
 * Precedence, highest first:
 *
 *  1. **stopped** — the device is offline; nothing can succeed.
 *  2. **error** — a request failed and has not been retried into success.
 *  3. **connecting** — a request is in flight and nothing has loaded yet.
 *  4. **running** — online, no failures, and either settled or a background
 *     refetch is running over already-loaded data.
 */
export function deriveConnectionStatus(signals: ConnectionSignals): ConnectionStatus {
  if (!signals.isOnline) return 'stopped'
  if (signals.isError) return 'error'
  if (signals.isFetching && !signals.hasData) return 'connecting'
  return 'running'
}
