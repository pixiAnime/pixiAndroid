/**
 * Loading / error / empty presentation — the mobile port of
 * `pixiWeb/src/components/states/`.
 *
 * The web keeps these deliberately plain: a bordered `bg-card` panel with a
 * mono micro-label, a heading and a muted one-liner, so the app never grows a
 * second visual language for failure. Every page in the web build resolves to
 * one of these, and so does every page here.
 */
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { AlertTriangle, CloudOff, RefreshCw, SearchX, ShieldAlert } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Primitives'
import { toAppError, type AppErrorInfo } from '@/lib/errors'
import { colors, fonts, layout, radii, spacing, text } from '@/theme'

/* ------------------------------------------------------------------ Error */

const ICONS: Record<AppErrorInfo['kind'], typeof AlertTriangle> = {
  'jikan-unavailable': CloudOff,
  'rate-limited': AlertTriangle,
  'not-found': SearchX,
  'bad-request': AlertTriangle,
  'bridge-offline': CloudOff,
  'bridge-error': ShieldAlert,
  empty: SearchX,
  unexpected: AlertTriangle,
}

export interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  /** Compact variant for rows/sections instead of full pages. */
  compact?: boolean
}

export function ErrorState({ error, onRetry, compact = false }: ErrorStateProps) {
  const info = toAppError(error)
  const Icon = ICONS[info.kind]

  return (
    <View
      accessibilityRole="alert"
      style={[styles.errorPanel, compact ? styles.errorCompact : styles.errorFull]}>
      <View style={styles.iconBox}>
        <Icon size={20} color={colors.mutedForeground} strokeWidth={1.6} />
      </View>
      <View style={styles.errorCopy}>
        <Text style={styles.errorTitle}>{info.title}</Text>
        <Text style={styles.errorDescription}>{info.description}</Text>
      </View>
      {info.retryable && onRetry ? (
        <Button variant="outline" size="sm" onPress={onRetry}>
          <RefreshCw size={13} color={colors.foreground} strokeWidth={1.6} />
          {'Try again'}
        </Button>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ Empty */

export interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  /** Added for the RN port: some pages put a call-to-action under the copy. */
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyPanel}>
      <View style={styles.iconBox}>
        {icon ?? <SearchX size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title ?? 'Nothing here yet'}</Text>
        {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      </View>
      {action}
    </View>
  )
}

/* -------------------------------------------------------------- Skeletons */

/** One poster-shaped card skeleton — `aspect-[2/3]` + two text lines. */
export function AnimeCardSkeleton({ width = '100%' }: { width?: number | `${number}%` }) {
  const posterHeight = typeof width === 'number' ? Math.round(width * 1.5) : 216
  return (
    <View style={[styles.cardSkeleton, { width }]}>
      <Skeleton width="100%" height={posterHeight} radius={radii.lg} />
      <Skeleton width="80%" height={14} radius={0} />
      <Skeleton width="40%" height={12} radius={0} />
    </View>
  )
}

/**
 * Card width for horizontal rows — the single source of truth shared by
 * `SectionScroller` and `AnimeRowSkeleton`, so loading and loaded rows have
 * the exact same geometry (no width jump when data arrives).
 */
export const ROW_CARD_WIDTH = layout.rowCardWidth

/**
 * Horizontal row of card skeletons — mirrors `SectionScroller`'s row markup
 * (same widths and gaps) so the layout never jumps and the skeleton can't
 * spill past the viewport.
 */
export function AnimeRowSkeleton({ count = 8, width = ROW_CARD_WIDTH }: { count?: number; width?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.row}>
      {Array.from({ length: count }).map((_, index) => (
        <AnimeCardSkeleton key={index} width={width} />
      ))}
    </View>
  )
}

/** Gutter as a percentage of the row — see `AnimeGridSkeleton`. */
const GRID_GAP_PCT = 5

/**
 * Multi-column grid of card skeletons (2-up on a phone, like `grid-cols-2`).
 *
 * Cells are sized as a percentage and the row uses `space-between` rather
 * than `columnGap`: a fixed gap added to percentage widths overflows 100% and
 * Yoga silently wraps it to a single column. The 5% remainder becomes the
 * gutter, which is ~16px at phone content widths — the web's `gap-4`.
 */
export function AnimeGridSkeleton({ count = 20, columns = 2 }: { count?: number; columns?: number }) {
  const cellWidth = `${(100 - GRID_GAP_PCT * (columns - 1)) / columns}%` as `${number}%`
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.grid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: cellWidth }}>
          <AnimeCardSkeleton width={undefined} />
        </View>
      ))}
    </View>
  )
}

/** Hero placeholder — `h-28rem` block with the copy block pre-laid out. */
export function HeroSkeleton() {
  return (
    <View style={styles.hero}>
      <Skeleton width="100%" height="100%" radius={0} />
      <View style={styles.heroCopy}>
        <Skeleton width="66%" height={28} radius={0} />
        <Skeleton width="33%" height={16} radius={0} />
        <Skeleton width="100%" height={12} radius={0} />
        <Skeleton width="80%" height={12} radius={0} />
        <View style={styles.heroActions}>
          <Skeleton width={112} height={32} />
          <Skeleton width={96} height={32} />
        </View>
      </View>
    </View>
  )
}

/** Section row placeholder (characters, recommendations…). */
export function SectionSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.section}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.sectionRow}>
          <Skeleton width={40} height={40} />
          <View style={styles.sectionCopy}>
            <Skeleton width="75%" height={12} />
            <Skeleton width="50%" height={10} />
          </View>
        </View>
      ))}
    </View>
  )
}

/** Detail page placeholder. */
export function DetailSkeleton() {
  return (
    <View style={styles.detail}>
      <Skeleton width="100%" height={160} radius={0} />
      <View style={styles.detailBody}>
        <Skeleton width={192} height={288} radius={0} />
        <View style={styles.detailCopy}>
          <Skeleton width="66%" height={32} />
          <Skeleton width="33%" height={16} />
          <View style={styles.detailTags}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} width={80} height={24} />
            ))}
          </View>
          <View style={styles.detailLines}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} width="100%" height={12} />
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

/* ----------------------------------------------------------------- shared */

/** The `role="status"` refresh affordance the web shows when refetching. */
export function RefetchingLabel({ label = 'Refreshing' }: { label?: string }) {
  return (
    <View style={styles.refetch}>
      <RefreshCw size={11} color={colors.mutedForeground} strokeWidth={1.6} />
      <Text style={text.monoMicro}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  errorPanel: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  errorFull: { paddingHorizontal: spacing.xxl, paddingVertical: 64 },
  errorCompact: { paddingHorizontal: spacing.xl, paddingVertical: 32 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCopy: { alignItems: 'center', gap: 6 },
  errorTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.foreground, textAlign: 'center' },
  errorDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
  },

  emptyPanel: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyCopy: { alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.foreground, textAlign: 'center' },
  emptyDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 320,
  },

  cardSkeleton: { gap: spacing.sm, flexShrink: 0 },
  row: { flexDirection: 'row', gap: spacing.md, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  hero: {
    height: 448,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroCopy: { position: 'absolute', left: 24, right: 24, bottom: 24, gap: 12 },
  heroActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  section: { gap: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
  },
  sectionCopy: { flex: 1, gap: 6, paddingTop: 2 },
  detail: { gap: 32 },
  detailBody: { gap: spacing.xl, alignItems: 'center' },
  detailCopy: { gap: spacing.md, alignSelf: 'stretch' },
  detailTags: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  detailLines: { gap: spacing.sm },
  refetch: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
})
