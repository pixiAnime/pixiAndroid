/**
 * Anime detail page — full metadata, characters, relations,
 * recommendations, and the Watch section (metadata only;
 * no streaming API — see providers/episode).
 *
 * Direct port of `pixiWeb/src/pages/AnimeDetails/AnimeDetails.tsx`: the same
 * three queries, the same "detail skeleton → content → error + retry" states,
 * the same recently-viewed write, the same character / related / recommendation
 * rows, and the same i18n keys. Only the mechanism changes:
 *
 *  - `/anime/:id` → `route.params.malId`, `/watch/:id/:ep` → the `Watch` route;
 *  - `<Link>` → `navigation.navigate`, the external MAL link → `Linking`;
 *  - Tailwind classes → `StyleSheet` entries from `@/theme`;
 *  - the banner keeps the web's geometry (`-mx-4` full-bleed past the page
 *    gutters, head riding up `-mt-24` over it) and its `bg-linear-to-t` scrim
 *    is drawn with `react-native-svg`, exactly like `Hero` does.
 */
import { useEffect, useMemo, useId, type ReactNode } from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack'
import { ArrowRight, Calendar, Clapperboard, Play, Star, Users } from '@/components/icons'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import type { JikanAnime } from '@/api/jikan/types'
import { AnimeCard, FavoriteButton, SafeImage, TagBadge } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { DetailSkeleton, EmptyState, ErrorState, SectionSkeleton } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Chip, Separator } from '@/components/ui/Primitives'
import { useAnimeCharacters, useAnimeDetail, useAnimeRecommendations } from '@/hooks/useAnimeData'
import { formatDateRange, formatNumber, formatScore, padEpisode } from '@/lib/format'
import type { RootStackParamList } from '@/navigation/types'
import { useHistoryStore } from '@/stores/historyStore'
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore'
import { colors, fonts, layout, radii, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

type Route = NativeStackScreenProps<RootStackParamList, 'AnimeDetail'>['route']
type Nav = NativeStackNavigationProp<RootStackParamList>

/** Tailwind `sm:` / `lg:` — the web's media queries, driven by window width. */
const SM_BREAKPOINT = 640
const LG_BREAKPOINT = 1024

export function AnimeDetailsPage() {
  const { t } = useTranslation()
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { width } = useWindowDimensions()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  const animeId = route.params.malId

  const detail = useAnimeDetail(animeId)
  const characters = useAnimeCharacters(animeId)
  const recommendations = useAnimeRecommendations(animeId)
  const recordView = useRecentlyViewedStore((s) => s.recordView)
  const historyEntries = useHistoryStore((s) => s.entries)

  const anime = detail.data

  // Track in Recently Viewed once details land.
  useEffect(() => {
    if (!anime) return
    recordView({
      animeId: anime.mal_id,
      title: anime.title_english ?? anime.title,
      posterUrl: anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? null,
    })
  }, [anime, recordView])

  const inProgress = useMemo(
    () => historyEntries.find((e) => e.animeId === animeId),
    [historyEntries, animeId],
  )

  const wide = width >= SM_BREAKPOINT
  const lg = width >= LG_BREAKPOINT
  /** Width of the page body inside `ScreenLayout`'s gutters. */
  const contentWidth = width - layout.contentPaddingX * 2
  /** Information grid: `sm:grid-cols-2 lg:grid-cols-3`. */
  const infoColumns = lg ? 3 : wide ? 2 : 1
  const infoCellWidth = Math.floor(
    (contentWidth - spacing.lg * 2 - spacing.xl * (infoColumns - 1)) / infoColumns,
  )
  /** Recommendations: `grid-cols-2` on a phone, `gap-4` between cells. */
  const recCardWidth = Math.floor((contentWidth - spacing.lg) / 2)
  /** Poster column: `w-44 sm:w-52 lg:w-full` (16rem grid track). */
  const posterWidth = lg ? 256 : wide ? 208 : 176

  /* ---------------- states ---------------- */

  if (detail.isLoading) {
    return (
      <ScreenLayout contentStyle={{ gap: spacing.lg }}>
        <DetailSkeleton />
        <SectionSkeleton count={6} />
      </ScreenLayout>
    )
  }

  // No cached data to fall back on → error panel (with data present, the
  // detail keeps rendering even if a background refetch failed).
  if (!anime) {
    return (
      <ScreenLayout>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </ScreenLayout>
    )
  }

  const title = anime.title_english ?? anime.title
  const poster =
    anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? null
  const jpTitle = anime.title_japanese
  const synonyms = (anime.title_synonyms ?? []).filter((syn) => syn !== title && syn !== jpTitle)
  const synopsis = anime.synopsis?.replace(/\[Written by MAL Rewrite\]/g, '').trim()
  const genreList = [...(anime.genres ?? []), ...(anime.themes ?? [])]
  const relatedEntries =
    anime.relations?.flatMap((group) =>
      group.entry
        .filter((e) => e.type === 'anime')
        .map((e) => ({ ...e, relation: group.relation })),
    ) ?? []
  const watchEpisode = inProgress?.episode ?? 1

  const goWatch = () =>
    navigation.navigate('Watch', { malId: anime.mal_id, episode: watchEpisode })

  return (
    <ScreenLayout contentStyle={{ gap: spacing.xxl }}>
      {/* banner + head — the head paints above the banner (web: `-mt-24 z-10`) */}
      <View style={styles.bannerHead}>
        <View style={[styles.banner, wide && styles.bannerWide]}>
          {anime.background || poster ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.bannerArt}>
              <SafeImage alt={t('common.posterAlt', { title })} fill src={poster} />
            </View>
          ) : null}
          {/* `bg-linear-to-t from-background via-background/70 to-background/30` */}
          <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
            <Defs>
              <LinearGradient id={`${uid}banner`} x1={0} x2={0} y1={1} y2={0}>
                <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
                <Stop offset="0.5" stopColor={colors.background} stopOpacity={0.7} />
                <Stop offset="1" stopColor={colors.background} stopOpacity={0.3} />
              </LinearGradient>
            </Defs>
            <Rect fill={`url(#${uid}banner)`} height="100%" width="100%" />
          </Svg>
        </View>

        {/* head: poster + titles + actions */}
        <View style={[styles.head, lg && styles.headWide]}>
          <View style={[styles.posterCol, !lg && styles.posterColCentered, { width: posterWidth }]}>
            <SafeImage
              alt={t('common.posterAlt', { title })}
              priority
              src={poster}
              style={styles.poster}
            />
            {lg ? (
              <Meta
                href={anime.url}
                label={t('details.externalLabel')}
                value={t('details.externalValue')}
              />
            ) : null}
          </View>

          <View style={[styles.headBody, lg && styles.headBodyWide]}>
            {/* titles */}
            <View style={styles.titleBlock}>
              <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>
                {title}
              </Text>
              {jpTitle && jpTitle !== title ? (
                <Text style={styles.jpTitle}>{jpTitle}</Text>
              ) : null}
              {synonyms.length > 0 ? (
                <Text style={styles.aka}>{t('details.aka', { list: synonyms.join(', ') })}</Text>
              ) : null}
            </View>

            {/* badges */}
            <View style={styles.badges}>
              {anime.type ? <TagBadge>{anime.type}</TagBadge> : null}
              {anime.status ? <TagBadge>{anime.status}</TagBadge> : null}
              {anime.source ? (
                <TagBadge>{t('details.srcBadge', { source: anime.source })}</TagBadge>
              ) : null}
              {anime.season && anime.year ? (
                <TagBadge>{`${anime.season} ${anime.year}`}</TagBadge>
              ) : null}
            </View>

            {/* genres / themes / demographics */}
            {genreList.length > 0 ? (
              <View
                accessibilityLabel={t('a11y.genresAndThemes')}
                accessibilityRole="list"
                style={styles.genreRow}>
                {genreList.map((g) => (
                  <Chip
                    key={`g-${g.mal_id}`}
                    onPress={() => navigation.navigate('Browse', { genres: String(g.mal_id) })}>
                    {g.name}
                  </Chip>
                ))}
                {(anime.demographics ?? []).map((d) => (
                  <TagBadge key={`d-${d.mal_id}`}>{d.name}</TagBadge>
                ))}
              </View>
            ) : null}

            {/* score strip */}
            <View style={styles.scoreStrip}>
              <Stat
                icon={<Star color={colors.mutedForeground} size={14} strokeWidth={1.6} />}
                label={t('details.stats.score')}
                value={`${formatScore(anime.score)}${
                  anime.scored_by ? ` (${formatNumber(anime.scored_by)})` : ''
                }`}
              />
              <Stat
                icon={<Clapperboard color={colors.mutedForeground} size={14} strokeWidth={1.6} />}
                label={t('details.stats.rank')}
                value={anime.rank ? `#${formatNumber(anime.rank)}` : '—'}
              />
              <Stat
                icon={<Users color={colors.mutedForeground} size={14} strokeWidth={1.6} />}
                label={t('details.stats.popularity')}
                value={anime.popularity ? `#${formatNumber(anime.popularity)}` : '—'}
              />
              <Stat
                icon={<Calendar color={colors.mutedForeground} size={14} strokeWidth={1.6} />}
                label={t('details.stats.members')}
                value={formatNumber(anime.members)}
              />
              <Stat
                icon={<Calendar color={colors.mutedForeground} size={14} strokeWidth={1.6} />}
                label={t('details.stats.favorites')}
                value={formatNumber(anime.favorites)}
              />
            </View>

            {/* actions */}
            <View style={styles.actions}>
              <Button
                accessibilityLabel={t('details.watchAria', { title })}
                onPress={goWatch}
                size="lg">
                <Play color={colors.primaryForeground} size={16} strokeWidth={1.6} />
                <Text style={styles.actionLabel}>
                  {inProgress
                    ? t('details.continueEp', { num: padEpisode(inProgress.episode) })
                    : t('common.watchNow')}
                </Text>
              </Button>
              <FavoriteButton
                animeId={anime.mal_id}
                posterUrl={poster}
                score={anime.score}
                size="lg"
                title={anime.title}
                titleEnglish={anime.title_english}
              />
            </View>

            {/* synopsis */}
            {synopsis ? (
              <View style={styles.block}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  {t('details.synopsis')}
                </Text>
                <Text style={styles.synopsis}>{synopsis}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* information grid */}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('details.information')}
        </Text>
        <View style={styles.infoGrid}>
          <Meta
            label={t('details.meta.aired')}
            style={{ width: infoCellWidth }}
            value={formatDateRange(anime.aired?.from, anime.aired?.to)}
          />
          <Meta
            label={t('details.meta.status')}
            style={{ width: infoCellWidth }}
            value={anime.status ?? '—'}
          />
          <Meta
            label={t('details.meta.episodes')}
            style={{ width: infoCellWidth }}
            value={anime.episodes ? String(anime.episodes) : '—'}
          />
          <Meta
            label={t('details.meta.duration')}
            style={{ width: infoCellWidth }}
            value={anime.duration ?? '—'}
          />
          <Meta
            label={t('details.meta.rating')}
            style={{ width: infoCellWidth }}
            value={anime.rating ?? '—'}
          />
          <Meta
            label={t('details.meta.source')}
            style={{ width: infoCellWidth }}
            value={anime.source ?? '—'}
          />
          <Meta
            label={t('details.meta.studios')}
            style={{ width: infoCellWidth }}
            value={(anime.studios ?? []).map((s) => s.name).join(', ') || '—'}
          />
          <Meta
            label={t('details.meta.producers')}
            style={{ width: infoCellWidth }}
            value={(anime.producers ?? []).map((p) => p.name).join(', ') || '—'}
          />
          <Meta
            label={t('details.meta.licensors')}
            style={{ width: infoCellWidth }}
            value={(anime.licensors ?? []).map((l) => l.name).join(', ') || '—'}
          />
        </View>
      </View>

      {/* Watch section — metadata only (streaming API comes later) */}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('details.watchH2')}
        </Text>
        <View style={[styles.watchCard, wide && styles.watchCardRow]}>
          <View style={[styles.watchCopy, wide && styles.watchCopyGrow]}>
            <Text style={styles.watchLead}>
              {inProgress
                ? t('details.continueWithEp', { num: padEpisode(inProgress.episode) })
                : t('details.startWithEp', { num: padEpisode(1) })}
            </Text>
            <Text style={styles.watchDesc}>
              {anime.episodes
                ? t('details.episodesDuration', {
                    count: anime.episodes,
                    duration: anime.duration ?? t('details.durationUnknown'),
                  })
                : t('details.watchDescFallback')}
            </Text>
          </View>
          <Button onPress={goWatch}>
            <Play color={colors.primaryForeground} size={16} strokeWidth={1.6} />
            <Text style={styles.actionLabel}>{t('details.openPlayer')}</Text>
          </Button>
        </View>
      </View>

      <Separator />

      {/* characters */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('details.characters')}
          </Text>
          <Text style={styles.sectionMeta}>
            {t('common.listedCount', { count: characters.data?.length ?? 0 })}
          </Text>
        </View>

        {characters.isLoading ? (
          <SectionSkeleton count={8} />
        ) : characters.isError && (characters.data ?? []).length === 0 ? (
          <ErrorState
            compact
            error={characters.error}
            onRetry={() => characters.refetch()}
          />
        ) : (characters.data ?? []).length === 0 ? (
          <EmptyState title={t('details.noCharacters')} />
        ) : (
          <ScrollView
            accessibilityRole="list"
            contentContainerStyle={{
              gap: wide ? spacing.lg : spacing.md,
              paddingBottom: spacing.xs,
            }}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {(characters.data ?? []).slice(0, 20).map((entry) => (
              <View key={entry.character.mal_id} style={styles.charCard}>
                <SafeImage
                  alt={entry.character.name}
                  src={entry.character.images?.jpg?.image_url}
                  style={styles.charImage}
                />
                <View style={styles.charBody}>
                  <Text numberOfLines={1} style={styles.charName}>
                    {entry.character.name}
                  </Text>
                  <Text style={styles.charRole}>{entry.role}</Text>
                  {entry.voices && entry.voices.length > 0 ? (
                    <Text numberOfLines={1} style={styles.charVoice}>
                      {entry.voices[0].name}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* related */}
      {relatedEntries.length > 0 ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('details.related')}
          </Text>
          <View style={styles.relatedRow}>
            {relatedEntries.map((entry) => (
              <Pressable
                accessibilityRole="link"
                key={`${entry.relation}-${entry.mal_id}`}
                onPress={() => navigation.navigate('AnimeDetail', { malId: entry.mal_id })}
                style={({ pressed }) => [
                  styles.relatedChip,
                  pressed && styles.relatedChipPressed,
                ]}>
                {({ pressed }) => (
                  <>
                    <Text style={styles.relatedRelation}>{entry.relation}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.relatedName, pressed && styles.relatedNamePressed]}>
                      {entry.name}
                    </Text>
                    <ArrowRight color={colors.mutedForeground} size={12} strokeWidth={1.6} />
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* recommendations */}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {t('details.recommendations')}
        </Text>
        {recommendations.isLoading ? (
          <SectionSkeleton count={6} />
        ) : recommendations.isError &&
          (recommendations.data?.data ?? []).length === 0 ? (
          <ErrorState
            compact
            error={recommendations.error}
            onRetry={() => recommendations.refetch()}
          />
        ) : (recommendations.data?.data ?? []).length === 0 ? (
          <EmptyState title={t('details.noRecommendations')} />
        ) : (
          <View style={styles.recGrid}>
            {(recommendations.data?.data ?? []).map((rec) => (
              <AnimeCard
                anime={rec.entry as unknown as JikanAnime}
                key={rec.entry.mal_id}
                style={{ width: recCardWidth }}
              />
            ))}
          </View>
        )}
      </View>
    </ScreenLayout>
  )
}

/* ---------------- small local helpers ---------------- */

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.statIcon}>
        {icon}
      </View>
      <View style={styles.statCopy}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  )
}

function Meta({
  label,
  value,
  href,
  style,
}: {
  label: string
  value: ReactNode
  href?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.meta, style]}>
      <Text style={styles.metaLabel}>{label}</Text>
      {href ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(href).catch(() => undefined)}>
          <Text numberOfLines={1} style={[styles.metaValue, styles.metaLink]}>
            {value}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.metaValue}>{value}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  /* ---------------- banner + head ---------------- */
  bannerHead: { position: 'relative' },
  /** `-mx-4 sm:-mx-6 h-44 sm:h-56 border-y` — full-bleed past the gutters. */
  banner: {
    height: 176,
    marginHorizontal: -layout.contentPaddingX,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  bannerWide: { height: 224 },
  bannerArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** `-mt-24 grid gap-8 lg:grid-cols-[16rem_1fr] relative z-10` */
  head: { marginTop: -96, zIndex: 10, flexDirection: 'column', gap: spacing.xxl },
  headWide: { flexDirection: 'row' },
  /** `mx-auto w-44 sm:w-52 lg:mx-0 lg:w-full` */
  posterCol: { gap: spacing.md },
  posterColCentered: { alignItems: 'center' },
  poster: { width: '100%', borderRadius: radii.lg, overflow: 'hidden' },
  headBody: { flexDirection: 'column', gap: spacing.lg, minWidth: 0 },
  /** `1fr` of `lg:grid-cols-[16rem_1fr]` — only where the width is definite. */
  headBodyWide: { flex: 1 },

  titleBlock: { flexDirection: 'column', gap: spacing.s1_5 },
  /** `font-heading text-2xl sm:text-3xl leading-tight font-semibold tracking-tight` */
  title: { ...text.heroTitle, color: colors.foreground },
  titleWide: { fontSize: 30, lineHeight: 38 },
  /** `text-sm text-muted-foreground` */
  jpTitle: { ...text.body, color: colors.mutedForeground },
  /** `font-mono text-[0.7rem] text-muted-foreground` — not uppercased. */
  aka: { fontFamily: fonts.mono, fontSize: 11.2, lineHeight: 16, color: colors.mutedForeground },

  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s1_5,
  },
  /** `flex flex-wrap gap-1.5` — genres, themes and demographics. */
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },

  /** `flex flex-wrap gap-x-6 gap-y-2 border-y py-3` */
  scoreStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xl,
    rowGap: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statIcon: { flexDirection: 'row' },
  statCopy: { flexDirection: 'column' },
  /** `font-mono text-[0.6rem] tracking-wider uppercase text-muted-foreground` */
  statLabel: { ...text.monoMicro },
  /** `font-mono text-xs tabular-nums text-foreground` */
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },

  /** `flex flex-wrap gap-2` */
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  /** Label on the white (default-variant) buttons — `Button` styles strings only. */
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.primaryForeground,
  },

  /* ---------------- blocks ---------------- */
  /** `space-y-3` */
  section: { flexDirection: 'column', gap: spacing.md },
  /** `space-y-2` */
  block: { flexDirection: 'column', gap: spacing.sm },
  /** `font-heading text-sm font-medium tracking-wide uppercase` */
  sectionTitle: { ...text.sectionTitle, color: colors.foreground },
  /** `flex items-baseline justify-between` */
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  /** `font-mono text-[0.65rem] text-muted-foreground` — not uppercased. */
  sectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  /** `text-sm leading-relaxed text-muted-foreground max-w-3xl` */
  synopsis: { ...text.body, color: colors.mutedForeground, maxWidth: 768 },

  /** Metadata grid. */
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xl,
    rowGap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
  },

  /** Watch call-to-action card. */
  watchCard: {
    flexDirection: 'column',
    gap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
  },
  watchCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  watchCopy: { flexDirection: 'column', gap: spacing.xs },
  watchCopyGrow: { flex: 1, minWidth: 0 },
  /** `text-sm font-medium` */
  watchLead: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  /** `text-xs text-muted-foreground` */
  watchDesc: { ...text.meta },

  /* ---------------- characters ---------------- */
  /** `flex gap-3 sm:gap-4 overflow-x-auto pb-1` */
  charCard: {
    width: 160,
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.sm,
  },
  /** `w-10 shrink-0` — keeps the web's 2:3 box (40 × 60). */
  charImage: { width: 40, flexShrink: 0, borderRadius: radii.sm, overflow: 'hidden' },
  charBody: { flex: 1, minWidth: 0 },
  /** `truncate text-xs font-medium` */
  charName: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.foreground },
  /** `font-mono text-[0.6rem] uppercase text-muted-foreground` */
  charRole: { ...text.monoMicro },
  /** `mt-0.5 truncate text-[0.65rem] text-muted-foreground` */
  charVoice: {
    fontFamily: fonts.regular,
    fontSize: 10.4,
    lineHeight: 15,
    color: colors.mutedForeground,
    marginTop: spacing.half,
  },

  /* ---------------- related ---------------- */
  relatedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  /** `flex items-center gap-2 border bg-card px-2.5 py-1.5` */
  relatedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.s1_5,
  },
  relatedChipPressed: { opacity: 0.75 },
  relatedRelation: { ...text.monoMicro },
  /** `text-xs group-hover:underline` */
  relatedName: { ...text.bodySm, color: colors.foreground },
  relatedNamePressed: { textDecorationLine: 'underline' },

  /* ---------------- recommendations ---------------- */
  /** `grid grid-cols-2 gap-4` */
  recGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },

  /* ---------------- meta / label ---------------- */
  meta: { flexDirection: 'column', gap: 2, minWidth: 0 },
  metaLabel: { ...text.monoMicro },
  /** `text-xs text-foreground` */
  metaValue: { ...text.bodySm, color: colors.foreground },
  metaLink: { textDecorationLine: 'underline' },
})
