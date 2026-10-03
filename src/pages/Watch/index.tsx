/**
 * Watch page — player area, title/meta + episode navigation, source and
 * subtitle pickers, episode grid, anime info. Direct port of
 * `pixiWeb/src/pages/Watch/Watch.tsx`.
 *
 * Regions and their order are the web's (back link → player → title/meta with
 * prev/next → pickers + provider notes → separator → anime info → episode
 * grid + pagination → meta note), with the pickers placed below the title
 * block as the brief requires. The web's two-column grid (`1fr 20rem`) is
 * flattened into one column on a phone, but keeps the same stacking order and
 * the same gaps: grid `gap-6` → 24, main column `space-y-4` → 16, aside
 * `space-y-3` → 12.
 *
 * Mechanism changes only:
 *
 *  - `/watch/:id/:episode` → `route.params`; episode navigation is
 *    `navigation.navigate('Watch', …)`, which updates the params in place —
 *    the RN analogue of the URL change;
 *  - `<Link>`/`useNavigate` → `navigation.navigate`. The web's
 *    `usePixiDialogStore` bridge dialog has no referent here (§26), so its
 *    `onPlaybackError` hook is dropped with it;
 *  - Tailwind → `StyleSheet` from `@/theme`, under
 *    `ScreenLayout scroll={false} padded={false}` so the 16:9 player is
 *    full-bleed and everything below it scrolls;
 *  - the record-the-view effect keeps the web's exact dependencies (and its
 *    `exhaustive-deps` suppression) so history is written per episode/page,
 *    and the player additionally pushes real progress through
 *    `historyStore.updateProgress`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Info, Puzzle } from 'lucide-react-native'

import { SafeImage } from '@/components/anime'
import { Footer, ScreenLayout, useIsFullscreen } from '@/components/layout'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Separator, Skeleton } from '@/components/ui/Primitives'
import { embeddedSubtitles, mergeSubtitles } from '@/extensions'
import { useAnimeDetail } from '@/hooks/useAnimeData'
import { prefetchEpisodes, useEpisodes } from '@/hooks/useEpisodes'
import { localizeExtensionMessage } from '@/i18n'
import { formatDate, padEpisode } from '@/lib/format'
import type { RootStackParamList } from '@/navigation/types'
import {
  selectAnimeHistory,
  selectWatchedEpisodes,
  useHistoryStore,
} from '@/stores/historyStore'
import { colors, fonts, layout, radii, spacing, text } from '@/theme'

import { EpisodeList } from './EpisodeList'
import {
  readAutoNext,
  readHoldRate,
  readSkipSeconds,
  readSubtitleSize,
  writeAutoNext,
  writeHoldRate,
  writeSkipSeconds,
  writeSubtitleSize,
} from './playerPrefs'
import { Player, ResolvingSource } from './Player'
import { SourceSelector } from './SourceSelector'
import { SubtitleSelector } from './SubtitleSelector'
import type { SubtitleSize } from './subtitleScale'
import { pickInitialSubtitle } from './subtitlePick'
import { useExtensionSources, useExtensionSubtitles } from './useExtensionSources'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

type Route = NativeStackScreenProps<RootStackParamList, 'Watch'>['route']
type Nav = NativeStackNavigationProp<RootStackParamList>

export function WatchPage() {
  const { t, i18n } = useTranslation()
  const route = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { width } = useWindowDimensions()
  const fullscreen = useIsFullscreen()

  const animeId = route.params.malId
  const episode = Math.max(1, route.params.episode || 1)

  /* ---------------- data ---------------- */

  const detail = useAnimeDetail(animeId)
  const anime = detail.data

  const totalEpisodes = anime?.episodes ?? null
  const [episodesPage, setEpisodesPage] = useState(1)
  const episodesQuery = useEpisodes(animeId, { totalEpisodes, page: episodesPage })

  /* ---------------- extension-backed playback ---------------- */

  const sourcesView = useExtensionSources(anime, episode)
  const sources = sourcesView.sources

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null)
  const [subtitleDelay, setSubtitleDelay] = useState(0)
  const appliedDefaultSub = useRef(false)

  /* ---------------- player preferences ---------------- */

  // The settings the viewer sets once: cue size, autoplay, and the two knobs
  // the gestures use. Read from MMKV through the localStorage shim, written
  // back on change.
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSize>(() => readSubtitleSize('medium'))
  const [autoNext, setAutoNext] = useState(() => readAutoNext())
  const [skipSeconds, setSkipSeconds] = useState(() => readSkipSeconds())
  const [holdRate, setHoldRate] = useState(() => readHoldRate())

  const handleSubtitleSize = useCallback((size: SubtitleSize) => {
    setSubtitleSize(size)
    writeSubtitleSize(size)
  }, [])

  const handleAutoNext = useCallback((value: boolean) => {
    setAutoNext(value)
    writeAutoNext(value)
  }, [])

  const handleSkipSeconds = useCallback((seconds: number) => {
    setSkipSeconds(seconds)
    writeSkipSeconds(seconds)
  }, [])

  const handleHoldRate = useCallback((rate: number) => {
    setHoldRate(rate)
    writeHoldRate(rate)
  }, [])

  // New episode → clear selections (fresh defaults apply below).
  useEffect(() => {
    setSelectedKey(null)
    setActiveSubtitle(null)
    appliedDefaultSub.current = false
  }, [animeId, episode])

  const selected = sources.find((source) => source.key === selectedKey) ?? sources[0] ?? null

  const subsView = useExtensionSubtitles(anime, episode, { enabled: sources.length > 0 })
  const subtitles = useMemo(
    () => mergeSubtitles([subsView.subtitles, embeddedSubtitles(selected)]),
    [subsView.subtitles, selected],
  )

  /**
   * The viewer's language (`tr`, `en`, `ru`, possibly tagged `tr-TR`).
   * Re-read every render so the auto-pick below follows a language change.
   */
  const appLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'en'

  // Pick the track the viewer is most likely to want: their own language
  // first, then whatever the provider flagged, then nothing — see
  // `./subtitlePick` for the rules and why they are in that order.
  useEffect(() => {
    if (appliedDefaultSub.current) return
    const preferred = pickInitialSubtitle(subtitles, appLanguage)
    if (preferred) {
      setActiveSubtitle(preferred)
      appliedDefaultSub.current = true
    }
  }, [subtitles, appLanguage])

  /**
   * Stop auto-picking the moment the viewer chooses for themselves. Without
   * this, a later `subtitles` change (a different source resolving) would
   * silently override a deliberate pick.
   */
  const handleSubtitleChange = useCallback((key: string | null) => {
    appliedDefaultSub.current = true
    setActiveSubtitle(key)
  }, [])

  /* ---------------- history ---------------- */

  const entries = useHistoryStore((state) => state.entries)
  const recordWatch = useHistoryStore((state) => state.recordWatch)
  const updateProgress = useHistoryStore((state) => state.updateProgress)
  const watched = useMemo(() => selectWatchedEpisodes(entries, animeId), [entries, animeId])
  const lastWatched = useMemo(() => selectAnimeHistory(entries, animeId), [entries, animeId])

  // Which provider page holds the current episode? (Jikan: 100 per page)
  useEffect(() => {
    if (!totalEpisodes || totalEpisodes <= 100) return
    const targetPage = Math.ceil(episode / 100)
    setEpisodesPage((prev) => (prev === targetPage ? prev : targetPage))
  }, [episode, totalEpisodes])

  const episodes = episodesQuery.data?.episodes ?? []

  // Record this view in watch history (metadata known without a real player).
  useEffect(() => {
    if (!anime) return
    const epData = episodes.find((entry) => entry.number === episode)
    recordWatch({
      animeId: anime.mal_id,
      title: anime.title,
      titleEnglish: anime.title_english,
      posterUrl:
        anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? null,
      episode,
      episodeTitle: epData?.title ?? null,
      totalEpisodes: anime.episodes ?? null,
      progress: 0,
      position: 0,
    })
    // Prefetch the next page of episodes for smoother navigation.
    if (episodesQuery.data?.hasNextPage) {
      prefetchEpisodes(animeId, episodesPage + 1, totalEpisodes)
    }
    // recordWatch identity is stable (zustand action)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime?.mal_id, episode, episodesPage])

  const goTo = useCallback(
    (target: number) => {
      if (target < 1) return
      if (totalEpisodes && target > totalEpisodes) return
      navigation.navigate('Watch', { malId: animeId, episode: target })
    },
    [navigation, animeId, totalEpisodes],
  )

  /** The player's own progress feed (percent, seconds) → history store. */
  const handleProgress = useCallback(
    (progress: number, position: number) => {
      updateProgress(animeId, episode, progress, position)
    },
    [updateProgress, animeId, episode],
  )

  const hasNext = totalEpisodes ? episode < totalEpisodes : episodesQuery.data?.hasNextPage
  const hasPrev = episode > 1

  /* ---------------- states ---------------- */

  if (detail.isLoading) {
    return (
      <ScreenLayout contentStyle={SKELETON_CONTENT}>
        <Skeleton height={Math.round((width - layout.contentPaddingX * 2) * (9 / 16))} radius={0} />
        <Skeleton height={16} radius={0} width="33%" />
      </ScreenLayout>
    )
  }

  // No cached detail to fall back on → error panel (with data present, the
  // page keeps rendering even if a background refetch failed).
  if (!anime) {
    return (
      <ScreenLayout>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </ScreenLayout>
    )
  }

  const title = anime.title_english ?? anime.title
  const currentEpData = episodes.find((entry) => entry.number === episode)
  const poster = anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url ?? null
  const synopsis = anime.synopsis?.replace(/\[Written by MAL Rewrite\]/g, '').trim()

  const failedSourceOutcomes = sourcesView.outcomes.filter((outcome) => outcome.error)
  const failedSubtitleOutcomes = subsView.outcomes.filter((outcome) => outcome.error)
  const sourceNotes = failedSourceOutcomes.map((outcome) => ({
    id: outcome.extensionId,
    text: `${outcome.extensionName}: ${localizeExtensionMessage(outcome.error?.message ?? '', t)}`,
  }))
  const subtitleNotes = failedSubtitleOutcomes.map((outcome) => ({
    id: outcome.extensionId,
    text: `${outcome.extensionName}: ${localizeExtensionMessage(outcome.error?.message ?? '', t)}`,
  }))

  const openExtensions = () => navigation.navigate('Extensions')

  /* ---------------- player area ---------------- */

  const renderPlayerArea = () => {
    if (sourcesView.enabledCount === 0) {
      return (
        <View style={[styles.stack, styles.inset]}>
          <EmptyState
            icon={<Puzzle color={colors.mutedForeground} size={20} strokeWidth={1.6} />}
            title={t('watch.noExtsTitle')}
            description={t('watch.noExtsDesc')}
          />
          <View style={styles.centerRow}>
            <ExtensionsCta onPress={openExtensions} />
          </View>
        </View>
      )
    }

    if (sources.length === 0 && sourcesView.isLoading) {
      return (
        <View style={styles.inset}>
          <ResolvingSource />
        </View>
      )
    }

    if (sources.length === 0) {
      return (
        <View style={[styles.stack, styles.inset]}>
          <EmptyState
            icon={<Puzzle color={colors.mutedForeground} size={20} strokeWidth={1.6} />}
            title={t('watch.noSourcesTitle')}
            description={
              failedSourceOutcomes.length > 0
                ? t('watch.noSourcesFailedDesc')
                : t('watch.noSourcesNoneDesc')
            }
          />
          {sourceNotes.length > 0 ? <NotesCard lines={sourceNotes} /> : null}
          <View style={styles.centerRow}>
            <Button
              onPress={() => {
                sourcesView.refetch()
              }}
              size="sm"
              variant="outline">
              {t('common.tryAgain')}
            </Button>
            <ExtensionsCta onPress={openExtensions} />
          </View>
        </View>
      )
    }

    // Full-bleed: only the picture breaks the page gutters.
    return (
      <Player
        activeSubtitleKey={activeSubtitle}
        autoNext={autoNext}
        episodeNav={{
          currentEpisode: episode,
          episodes,
          hasNext: hasNext ?? false,
          hasPrev,
          loading: episodesQuery.isLoading,
          onNext: () => goTo(episode + 1),
          onPrev: () => goTo(episode - 1),
          onSelect: (episodeNumber) => goTo(episodeNumber),
          watched,
        }}
        holdRate={holdRate}
        label={`${title} — ${t('common.episode', { num: padEpisode(episode) })}`}
        onAutoNextChange={handleAutoNext}
        onHoldRateChange={handleHoldRate}
        onProgressChange={handleProgress}
        onRequestNext={hasNext ? () => goTo(episode + 1) : undefined}
        onSkipSecondsChange={handleSkipSeconds}
        onSubtitleChange={handleSubtitleChange}
        onSubtitleDelayChange={setSubtitleDelay}
        onSubtitleSizeChange={handleSubtitleSize}
        skipSeconds={skipSeconds}
        source={selected ?? sources[0]}
        subtitleDelay={subtitleDelay}
        subtitleSize={subtitleSize}
        subtitles={subtitles}
      />
    )
  }

  const openDetail = () => navigation.navigate('AnimeDetail', { malId: animeId })

  /* ---------------- render ---------------- */

  return (
    <ScreenLayout footer={false} padded={false} scroll={false}>
      {/*
        Fullscreen collapses the page to just the picture. The back bar and the
        scrolling body are *hidden*, not unmounted: they are not ancestors of
        the player, so nothing remounts, and the body's scroll offset survives
        the round trip.
      */}
      {/* back link — `inline-flex items-center gap-1 font-mono uppercase` */}
      <Pressable
        accessibilityRole="link"
        onPress={openDetail}
        style={fullscreen ? styles.hidden : styles.backBar}>
        <View accessible={false} importantForAccessibility="no" style={styles.backIcon}>
          <ChevronLeft color={colors.mutedForeground} size={12} strokeWidth={1.6} />
        </View>
        <Text numberOfLines={1} style={styles.backLink}>
          {title}
        </Text>
      </Pressable>

      {/* player region */}
      <View style={fullscreen ? styles.playerAreaFull : styles.playerArea}>
        {renderPlayerArea()}
      </View>

      {/* scrolling body */}
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={fullscreen ? styles.hidden : styles.scroll}>
        {/* ---------------- main column ---------------- */}
        <View style={styles.mainStack}>
          {/* title + episode navigation */}
          <View style={styles.stack}>
            <View style={styles.titleRow}>
              <View style={styles.titleMain}>
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                <Text style={styles.subtitle}>
                  {t('common.episode', { num: padEpisode(episode) })}
                  {currentEpData?.title ? ` · ${currentEpData.title}` : ''}
                  {currentEpData?.airDate ? ` · ${formatDate(currentEpData.airDate)}` : ''}
                </Text>
              </View>

              <View style={styles.navRow}>
                <Button
                  accessibilityLabel={t('watch.prevAria')}
                  disabled={!hasPrev}
                  onPress={() => goTo(episode - 1)}
                  size="sm"
                  variant="outline">
                  <ChevronLeft color={colors.foreground} size={14} strokeWidth={1.6} />
                  <Text style={styles.navLabel}>{t('watch.prev')}</Text>
                </Button>
                <Button
                  accessibilityLabel={t('watch.nextAria')}
                  disabled={!hasNext}
                  onPress={() => goTo(episode + 1)}
                  size="sm"
                  variant="outline">
                  <Text style={styles.navLabel}>{t('watch.next')}</Text>
                  <ChevronRight color={colors.foreground} size={14} strokeWidth={1.6} />
                </Button>
                <Button
                  accessibilityLabel={t('watch.infoAria')}
                  onPress={openDetail}
                  size="sm"
                  variant="ghost">
                  <Info color={colors.foreground} size={14} strokeWidth={1.6} />
                </Button>
              </View>
            </View>

            {/* continue point hint */}
            {lastWatched && lastWatched.episode !== episode ? (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>
                  {t('watch.lastWatched', { num: padEpisode(lastWatched.episode) })}
                </Text>
                <Button onPress={() => goTo(lastWatched.episode)} size="xs" variant="ghost">
                  {t('watch.jumpBack')}
                </Button>
              </View>
            ) : null}
          </View>

          {/* source + subtitle pickers + provider notes */}
          {sources.length > 0 ? (
            <View style={styles.stack}>
              <SourceSelector
                onSelect={setSelectedKey}
                selectedKey={selected?.key ?? null}
                sources={sources}
              />
              <SubtitleSelector
                activeKey={activeSubtitle}
                onChange={setActiveSubtitle}
                subtitles={subtitles}
              />
              {subtitleNotes.length > 0 ? (
                <NotesCard lines={subtitleNotes} title={t('watch.subNotes')} />
              ) : null}
              {sourceNotes.length > 0 ? (
                <NotesCard lines={sourceNotes} title={t('watch.provNotes')} />
              ) : null}
            </View>
          ) : null}

          <Separator />

          {/* anime information (compact) */}
          <View style={styles.stack}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {t('watch.animeInfo')}
            </Text>
            <View style={styles.infoCard}>
              <Pressable accessibilityRole="link" onPress={openDetail} style={styles.infoPoster}>
                <SafeImage alt={t('common.posterAlt', { title })} src={poster} style={styles.poster} />
              </Pressable>
              <View style={styles.infoBody}>
                <Text numberOfLines={1} style={styles.infoTitle}>
                  {title}
                </Text>
                {anime.title_japanese ? (
                  <Text numberOfLines={1} style={styles.infoJapanese}>
                    {anime.title_japanese}
                  </Text>
                ) : null}
                <Text style={styles.infoMeta}>
                  {`${anime.type ?? 'TV'} · ${
                    anime.episodes
                      ? t('watch.epsCount', { count: anime.episodes })
                      : `? ${t('watch.epsUnit')}`
                  } · ${anime.status ?? t('common.unknown')} · ${anime.aired?.string ?? '—'}`}
                </Text>
                <Text numberOfLines={2} style={styles.infoSynopsis}>
                  {synopsis}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---------------- episodes sidebar ---------------- */}
        <View style={styles.asideStack}>
          <View style={styles.stack}>
            <View style={styles.sectionHead}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {t('watch.episodes')}
              </Text>
              <Text style={styles.sectionMeta}>
                {totalEpisodes
                  ? t('watch.totalCount', { count: totalEpisodes })
                  : t('common.listedCount', { count: episodes.length })}
              </Text>
            </View>

            <View style={styles.episodeCard}>
              {episodesQuery.isLoading ? (
                <ResolvingEpisodes />
              ) : episodesQuery.isError && episodes.length === 0 ? (
                <ErrorState
                  compact
                  error={episodesQuery.error}
                  onRetry={() => episodesQuery.refetch()}
                />
              ) : episodes.length === 0 ? (
                <EmptyState
                  description={t('watch.noEpisodesDesc')}
                  title={t('watch.noEpisodesTitle')}
                />
              ) : (
                <EpisodeList
                  currentEpisode={episode}
                  episodes={episodes}
                  onSelect={(number) => goTo(number)}
                  watched={watched}
                />
              )}
            </View>

            {/* pagination for >100 episodes */}
            {episodesQuery.data ? (
              <View style={styles.pagination}>
                <Pressable
                  disabled={episodesPage <= 1}
                  onPress={() => setEpisodesPage((page) => Math.max(1, page - 1))}
                  style={[styles.pageButton, episodesPage <= 1 && styles.pageButtonDisabled]}>
                  <Text style={styles.pageButtonText}>{t('watch.prevPage')}</Text>
                </Pressable>
                <Text style={styles.sectionMeta}>
                  {t('watch.pageOf', {
                    page: episodesPage,
                    pages: Math.max(
                      episodesQuery.data.page,
                      totalEpisodes ? Math.ceil(totalEpisodes / 100) : episodesQuery.data.page,
                    ),
                  })}
                </Text>
                <Pressable
                  disabled={!episodesQuery.data.hasNextPage}
                  onPress={() => setEpisodesPage((page) => page + 1)}
                  style={[
                    styles.pageButton,
                    !episodesQuery.data.hasNextPage && styles.pageButtonDisabled,
                  ]}>
                  <Text style={styles.pageButtonText}>{t('watch.nextPage')}</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.metaNote}>
              {`${t('watch.metaPrefix')} `}
              <Text style={styles.metaNoteValue}>
                {sourcesView.enabledCount > 0
                  ? t('watch.extensionsCount', { count: sourcesView.enabledCount })
                  : t('watch.noExtensions')}
              </Text>
              {sourcesView.enabledCount === 0
                ? ` ${t('watch.installOne')}`
                : ` · ${t('watch.sourceCount', { count: sources.length })}`}
            </Text>
          </View>
        </View>

        {/* `ScreenLayout footer={false}` skips it — the web keeps one at the
            end of the document, so it is rendered here, full-bleed. */}
        <View style={styles.footerWrap}>
          <Footer />
        </View>
      </ScrollView>
    </ScreenLayout>
  )
}

/* ---------------- local components ---------------- */

function ExtensionsCta({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation()
  return (
    <Button onPress={onPress} size="sm" variant="outline">
      <Puzzle color={colors.foreground} size={13} strokeWidth={1.6} />
      <Text style={styles.navLabel}>{t('watch.openExtensions')}</Text>
    </Button>
  )
}

/** `font-mono text-xs` spinner row (the web's `Loader2` line). */
function ResolvingEpisodes() {
  const { t } = useTranslation()
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={colors.mutedForeground} size="small" />
      <Text style={styles.loadingText}>{t('common.loadingEpisodes')}</Text>
    </View>
  )
}

interface NoteLine {
  id: string
  text: string
}

/** `border border-border bg-card/60 px-3 py-2` extension failure notes. */
function NotesCard({ lines, title }: { lines: NoteLine[]; title?: string }) {
  return (
    <View style={styles.notes}>
      {title ? <Text style={styles.notesTitle}>{title}</Text> : null}
      {lines.map((line) => (
        <Text key={line.id} style={styles.notesLine}>
          {line.text}
        </Text>
      ))}
    </View>
  )
}

const SKELETON_CONTENT = { gap: spacing.lg } as const

const styles = StyleSheet.create({
  /** `space-y-3` generic stack. */
  stack: { flexDirection: 'column', gap: spacing.md },
  /** Non-video player states keep the page gutters; the picture does not. */
  inset: { marginHorizontal: layout.contentPaddingX },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  scroll: { flex: 1, minHeight: 0 },
  /** top-level `gap-6` + the web's page `py-6`. */
  body: {
    flexDirection: 'column',
    gap: spacing.xl,
    paddingHorizontal: layout.contentPaddingX,
    paddingTop: layout.contentPaddingY,
    paddingBottom: spacing.xxl,
  },
  /** `min-w-0 space-y-4` main column. */
  mainStack: { flexDirection: 'column', gap: spacing.lg, minWidth: 0 },
  /** `space-y-3` sidebar. */
  asideStack: { flexDirection: 'column', gap: spacing.md, minWidth: 0 },

  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: layout.contentPaddingX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  backIcon: { flexDirection: 'row' },
  /** `font-mono text-[0.7rem] tracking-wide uppercase text-muted-foreground` */
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    flexShrink: 1,
  },

  playerArea: { marginBottom: spacing.xl },
  /** Fullscreen: the picture takes the whole column, gutters and body gone. */
  playerAreaFull: { flex: 1, minHeight: 0 },
  /** Collapsed rather than unmounted, so scroll state survives fullscreen. */
  hidden: { display: 'none' },

  /** `flex flex-wrap items-start justify-between gap-3` */
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleMain: { flexShrink: 1, minWidth: 0, gap: spacing.half },
  /** `font-heading text-lg leading-tight font-semibold tracking-tight` */
  title: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.foreground },
  /** `mt-0.5 font-mono text-xs text-muted-foreground` */
  subtitle: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s1_5 },
  /** Button labels are styled here — `Button` only styles string children. */
  navLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.foreground,
  },

  /** `border border-border bg-card px-3 py-2 flex justify-between gap-3` */
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  /** `font-mono text-[0.7rem] text-muted-foreground` */
  hintText: { fontFamily: fonts.mono, fontSize: 11.2, lineHeight: 16, color: colors.mutedForeground, flexShrink: 1 },

  /** `font-heading text-sm font-medium tracking-wide uppercase` */
  sectionTitle: { ...text.sectionTitle, color: colors.foreground },
  /** `flex items-baseline justify-between` */
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  /** `font-mono text-[0.65rem] text-muted-foreground` — sentence case. */
  sectionMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },

  /** `flex gap-4 border border-border bg-card p-3` */
  infoCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
  },
  infoPoster: { flexShrink: 0 },
  /** `w-16 border border-border` — posters are 2:3, so 64 × 96. */
  poster: { width: 64, borderRadius: radii.sm, overflow: 'hidden' },
  infoBody: { flex: 1, minWidth: 0, gap: spacing.s1_5 },
  /** `truncate text-sm font-medium` */
  infoTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.foreground },
  /** `truncate text-xs text-muted-foreground` */
  infoJapanese: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  /** `font-mono text-[0.65rem] text-muted-foreground` */
  infoMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  /** `line-clamp-2 text-xs leading-relaxed text-muted-foreground` */
  infoSynopsis: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },

  /** Surface container wrapping the episode list. */
  episodeCard: { borderRadius: radii.lg, backgroundColor: colors.surfaceContainer, overflow: 'hidden' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },

  /** `flex items-center justify-between font-mono text-[0.65rem]` */
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pageButton: {
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageButtonDisabled: { opacity: 0.4 },
  /** `uppercase` mono micro-button. */
  pageButtonText: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },

  /** `font-mono text-[0.6rem] leading-relaxed text-muted-foreground` */
  metaNote: { fontFamily: fonts.mono, fontSize: 9.6, lineHeight: 14, letterSpacing: 0.5, color: colors.mutedForeground },
  /** `<span className="text-foreground">` inside the note. */
  metaNoteValue: { color: colors.foreground },

  notes: {
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  notesTitle: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  /** `font-mono text-[0.65rem] leading-relaxed text-muted-foreground` */
  notesLine: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },

  /** Cancels the ScrollView's gutters so the footer spans edge to edge. */
  footerWrap: { marginHorizontal: -layout.contentPaddingX },
})
