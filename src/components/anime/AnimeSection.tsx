/**
 * AnimeSection — a titled row wired to a query result:
 * loading → skeletons, error → friendly panel, empty → empty state.
 */
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'

import type { JikanAnime } from '@/api/jikan/types'
import { AnimeCard } from './AnimeCard'
import { SectionScroller } from './SectionScroller'
import { EmptyState, ErrorState } from '@/components/states'
import { Skeleton } from '@/components/ui/Primitives'
import { colors, layout, radii, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

/**
 * Card width for horizontal rows — the RN port of the web's `ROW_CARD_CLASS`
 * (`w-36 shrink-0`), shared by the skeleton and the loaded cards so nothing
 * moves when the data arrives.
 */
const ROW_CARD_WIDTH = layout.rowCardWidth
/** Web `AnimeRowSkeleton` renders eight cards. */
const SKELETON_COUNT = 8
/** Tailwind `sm:` — the row gap widens from 12 to 16 there. */
const SM_BREAKPOINT = 640

interface AnimeSectionProps {
  title: string
  subtitle?: string
  items?: JikanAnime[]
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  action?: ReactNode
  /** Card style for the horizontal row — the port of `cardClassName`. */
  cardStyle?: StyleProp<ViewStyle>
}

export function AnimeSection({
  title,
  subtitle,
  items,
  isLoading,
  error,
  onRetry,
  action,
  cardStyle,
}: AnimeSectionProps) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const wide = width >= SM_BREAKPOINT

  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.loadingLabel}>{t('common.loading')}</Text> : null}
        </View>
        <ScrollView
          contentContainerStyle={{ gap: wide ? spacing.lg : spacing.md, paddingBottom: spacing.xs }}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <View key={index} style={styles.skeletonCard}>
              <Skeleton
                height={Math.round(ROW_CARD_WIDTH * 1.5)}
                radius={radii.none}
                width={ROW_CARD_WIDTH}
              />
              <Skeleton height={14} width="80%" />
              <Skeleton height={12} width="40%" />
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  // Data wins over a failed background refetch — never swap a populated row
  // for an error panel (the cached list stays usable, e.g. during an outage).
  if (error && !items?.length) {
    return (
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        <ErrorState compact error={error} onRetry={onRetry} />
      </View>
    )
  }


  if (!items || items.length === 0) {
    return (
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
        <EmptyState description={t('home.noResultsDesc')} title={t('home.noResultsTitle')} />
      </View>
    )
  }

  return (
    <SectionScroller action={action} subtitle={subtitle} title={title}>
      {items.map((anime, index) => (
        <AnimeCard
          anime={anime}
          key={anime.mal_id}
          priority={index < 6}
          style={cardStyle ?? styles.card}
        />
      ))}
    </SectionScroller>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  /** `font-heading text-sm font-medium tracking-wide text-foreground uppercase` */
  sectionTitle: { ...text.sectionTitle, color: colors.foreground },
  /** `font-mono text-[0.65rem] text-muted-foreground` — `common.loading` stays lowercase. */
  loadingLabel: { ...text.monoSmall, letterSpacing: 0, textTransform: 'none' },
  card: { width: ROW_CARD_WIDTH, flexShrink: 0 },
  skeletonCard: { width: ROW_CARD_WIDTH, gap: spacing.sm },
})
