/**
 * Home — hero, continue watching (conditional), and discovery rows.
 *
 * Direct port of `pixiWeb/src/pages/Home/Home.tsx`: the same eight queries,
 * the same "cached hero wins over a failed background refetch" rule, and the
 * continue-watching row hidden entirely when empty (spec §16).
 */
import { useMemo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ArrowRight, Play } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { Hero, AnimeSection, SafeImage } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { ErrorState, HeroSkeleton } from '@/components/states'
import { Button } from '@/components/ui/Button'
import {
  useCurrentlyAiring,
  useCurrentSeasonAnime,
  useRecentlyUpdated,
  useSeasonNow,
  useTopAnime,
} from '@/hooks/useAnimeData'
import type { RootStackParamList } from '@/navigation/types'
import { selectContinueWatching, useHistoryStore } from '@/stores/historyStore'
import { filterAdult, pickStoredTitle, type AdultFields } from '@/lib/contentPreferences'
import { formatRelativeTime, padEpisode } from '@/lib/format'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function HomePage() {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()

  const seasonNow = useSeasonNow(20)
  const trending = useTopAnime('airing', 18)
  const popular = useTopAnime('bypopularity', 18)
  const topRated = useTopAnime(undefined, 18)
  const airing = useCurrentlyAiring(18)
  const thisSeason = useCurrentSeasonAnime(18)
  const upcoming = useTopAnime('upcoming', 18)
  const recentlyUpdated = useRecentlyUpdated(18)

  const historyEntries = useHistoryStore((s) => s.entries)
  const continueWatching = useMemo(
    () => selectContinueWatching(historyEntries).slice(0, 12),
    [historyEntries],
  )

  /** Drop adult-rated titles from every row when the preference is on. */
  const visible = <T extends AdultFields>(items: T[] | undefined): T[] | undefined =>
    items ? filterAdult(items) : undefined

  const heroAnime = filterAdult(seasonNow.data?.data ?? [])[0]

  return (
    <ScreenLayout contentStyle={styles.page}>
      {/* Hero — cached data wins over a failed background refetch */}
      {seasonNow.isLoading && !heroAnime ? (
        <HeroSkeleton />
      ) : heroAnime ? (
        <Hero anime={heroAnime} />
      ) : seasonNow.isError ? (
        <ErrorState error={seasonNow.error} onRetry={() => seasonNow.refetch()} />
      ) : null}

      {/* Continue watching — hidden entirely when empty (spec §16) */}
      {continueWatching.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitles}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {t('home.continueWatching')}
              </Text>
              <Text style={styles.sectionMeta}>{t('home.inProgress', { count: continueWatching.length })}</Text>
            </View>
            <Pressable
              accessibilityRole="link"
              style={styles.sectionLink}
              onPress={() => navigation.navigate('History')}>
              <Text style={styles.sectionLinkLabel}>{t('nav.history')}</Text>
              <ArrowRight size={12} color={colors.mutedForeground} strokeWidth={1.6} />
            </Pressable>
          </View>

          <FlatList
            accessibilityLabel={t('home.continueWatchingAria')}
            accessibilityRole="list"
            contentContainerStyle={styles.continueRow}
            data={continueWatching}
            decelerationRate="fast"
            horizontal
            /* Above the fold: mount the ~2 visible cards, stream the rest. */
            initialNumToRender={3}
            keyExtractor={(entry) => `${entry.animeId}-${entry.episode}`}
            maxToRenderPerBatch={3}
            renderItem={({ item: entry }) => (
              <Pressable
                accessibilityRole="button"
                style={styles.continueCard}
                onPress={() => navigation.navigate('Watch', { malId: entry.animeId, episode: entry.episode })}>
                <SafeImage src={entry.posterUrl} alt="" aspectRatio={2 / 3} style={styles.continuePoster} />
                <View style={styles.continueBody}>
                  <Text numberOfLines={1} style={styles.continueTitle}>
                    {pickStoredTitle(entry)}
                  </Text>
                  <Text style={styles.continueEpisode}>
                    {t('common.episode', { num: padEpisode(entry.episode) })}
                    {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ''}
                  </Text>
                  <View style={styles.continueFoot}>
                    <Text style={styles.continueTime}>{formatRelativeTime(entry.lastWatchedAt)}</Text>
                    <View style={styles.continueCta}>
                      <Play size={10} color={colors.foreground} strokeWidth={1.6} />
                      <Text style={styles.continueCtaLabel}>{t('common.continue')}</Text>
                    </View>
                  </View>
                  {typeof entry.progress === 'number' && entry.progress > 0 ? (
                    <View
                      accessibilityRole="progressbar"
                      accessibilityValue={{
                        min: 0,
                        max: 100,
                        now: Math.round(entry.progress),
                      }}
                      style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(entry.progress, 100)}%` as `${number}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
            windowSize={3}
          />
        </View>
      ) : null}

      {/* Discovery rows */}
      <AnimeSection
        title={t('home.rows.trending')}
        subtitle={t('home.subs.topAiring')}
        items={visible(trending.data?.data)}
        isLoading={trending.isLoading}
        error={trending.isError ? trending.error : null}
        onRetry={() => trending.refetch()}
        action={
          <RowAction
            route="Browse"
            params={{ status: 'airing', sort: 'desc', order_by: 'score' }}
          />
        }
      />
      <AnimeSection
        title={t('home.rows.popular')}
        subtitle={t('home.subs.byPopularity')}
        items={visible(popular.data?.data)}
        isLoading={popular.isLoading}
        error={popular.isError ? popular.error : null}
        onRetry={() => popular.refetch()}
      />
      <AnimeSection
        title={t('home.rows.topRated')}
        subtitle={t('home.subs.allTime')}
        items={visible(topRated.data?.data)}
        isLoading={topRated.isLoading}
        error={topRated.isError ? topRated.error : null}
        onRetry={() => topRated.refetch()}
      />
      <AnimeSection
        title={t('home.rows.airing')}
        items={visible(airing.data?.items)}
        isLoading={airing.isLoading}
        error={airing.isError ? airing.error : null}
        onRetry={() => airing.refetch()}
      />
      <AnimeSection
        title={t('home.rows.thisSeason')}
        items={visible(thisSeason.data?.data)}
        isLoading={thisSeason.isLoading}
        error={thisSeason.isError ? thisSeason.error : null}
        onRetry={() => thisSeason.refetch()}
      />
      <AnimeSection
        title={t('home.rows.upcoming')}
        items={visible(upcoming.data?.data)}
        isLoading={upcoming.isLoading}
        error={upcoming.isError ? upcoming.error : null}
        onRetry={() => upcoming.refetch()}
        action={<RowAction route="Browse" params={{ status: 'upcoming' }} />}
      />
      <AnimeSection
        title={t('home.rows.recentlyUpdated')}
        items={visible(recentlyUpdated.data?.data)}
        isLoading={recentlyUpdated.isLoading}
        error={recentlyUpdated.isError ? recentlyUpdated.error : null}
        onRetry={() => recentlyUpdated.refetch()}
      />
    </ScreenLayout>
  )
}

function RowAction({
  route,
  params,
}: {
  route: 'Browse'
  params?: RootStackParamList['Browse']
}) {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()
  return (
    <Button variant="ghost" size="xs" onPress={() => navigation.navigate(route, params)}>
      <Text style={styles.actionLabel}>{t('common.viewAll')}</Text>
      <ArrowRight size={12} color={colors.mutedForeground} strokeWidth={1.6} />
    </Button>
  )
}

const styles = StyleSheet.create({
  page: { gap: 40 },
  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitles: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  sectionTitle: { ...text.sectionTitle, color: colors.foreground },
  sectionMeta: { ...text.monoSmall, letterSpacing: 0, textTransform: 'none' },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionLinkLabel: { ...text.monoLabel, color: colors.mutedForeground },
  /* Horizontal-list content container — the row direction comes from `horizontal`. */
  continueRow: { gap: spacing.md },
  continueCard: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
    width: 256,
    flexShrink: 0,
  },
  continuePoster: { width: 48, flexShrink: 0, borderRadius: radii.sm, overflow: 'hidden' },
  continueBody: { flex: 1, minWidth: 0, gap: 2 },
  continueTitle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: colors.foreground },
  continueEpisode: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  continueFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  continueTime: { fontFamily: fonts.mono, fontSize: 9.6, lineHeight: 14, color: colors.mutedForeground },
  continueCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  continueCtaLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.foreground,
  },
  progressTrack: { height: 4, width: '100%', borderRadius: radii.pill, backgroundColor: colors.surfaceContainerHighest, marginTop: spacing.xs, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
  actionLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground },
})
