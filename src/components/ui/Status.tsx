/**
 * Connection-status presentation — the "Running / Stopped / Connecting / Error"
 * surface.
 *
 * `StatusIndicator` is the compact form (a coloured dot + label) used in the
 * top app bar. `StatusBanner` is the full-width form used where the state has
 * real consequences (source resolving, extension installs, Settings → About).
 *
 * Both are presentational: the status value comes from `useConnectionStatus`,
 * so these can be rendered anywhere without coupling to react-query. Callers
 * render them only while the status is not `running`, so the healthy state has
 * no visible surface.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { mobileKeys } from '@/i18n/mobile'
import type { ConnectionStatus } from '@/lib/connectionStatus'
import { colors, fonts, radii, spacing } from '@/theme'

/** The functional colour for a status — the only chromatic chrome in the app. */
export function statusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'running':
      return colors.statusRunning
    case 'connecting':
      return colors.statusConnecting
    case 'error':
      return colors.statusError
    case 'stopped':
      return colors.statusStopped
  }
}

function statusContainer(status: ConnectionStatus): string {
  switch (status) {
    case 'running':
      return colors.statusRunningContainer
    case 'connecting':
      return colors.statusConnectingContainer
    case 'error':
      return colors.statusErrorContainer
    case 'stopped':
      return colors.statusStoppedContainer
  }
}

const STATUS_KEYS: Record<ConnectionStatus, string> = {
  running: mobileKeys.running,
  connecting: mobileKeys.connecting,
  error: mobileKeys.error,
  stopped: mobileKeys.stopped,
}

/** Localised label for a status (used by both components). */
export function useStatusLabel(status: ConnectionStatus): string {
  const { t } = useTranslation()
  return t(STATUS_KEYS[status])
}

export interface StatusIndicatorProps {
  status: ConnectionStatus
  /** Show the text label beside the dot (default true). */
  showLabel?: boolean
  style?: object
}

export function StatusIndicator({ status, showLabel = true, style }: StatusIndicatorProps) {
  const { t } = useTranslation()
  const label = t(STATUS_KEYS[status])
  const tint = statusColor(status)

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(mobileKeys.aria, { status: label })}
      style={[styles.indicator, style]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      {showLabel ? <Text style={[styles.indicatorLabel, { color: tint }]}>{label}</Text> : null}
    </View>
  )
}

export interface StatusBannerProps {
  status: ConnectionStatus
  /** Optional supporting copy line. */
  description?: string
}

export function StatusBanner({ status, description }: StatusBannerProps) {
  const { t } = useTranslation()
  const label = t(STATUS_KEYS[status])
  const tint = statusColor(status)

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t(mobileKeys.aria, { status: label })}
      style={[styles.banner, { backgroundColor: statusContainer(status), borderColor: tint }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerLabel, { color: tint }]}>{label}</Text>
        {description ? <Text style={styles.bannerDescription}>{description}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  indicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.s1_5 },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  indicatorLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bannerCopy: { flex: 1, minWidth: 0, gap: 2 },
  bannerLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  bannerDescription: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
})
