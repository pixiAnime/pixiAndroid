/**
 * History — watch history across reloads (localStorage).
 *
 * Direct port of `pixiWeb/src/pages/History/History.tsx`: same header
 * (title + count subtitle + Clear), same empty state, same per-entry rows
 * (poster → anime detail, episode line, relative time / progress / episode
 * count meta, progress bar, Continue + remove actions) and the same
 * destructive "clear history" confirmation.
 *
 * Only the mechanism changes: `<Link>` becomes `navigation.navigate`, the
 * Radix dialog becomes `@/components/ui/Dialog`, Tailwind classes become
 * `StyleSheet` entries driven by `@/theme`.
 */
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronRight, History as HistoryIcon, Play, Trash2 } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { SafeImage } from '@/components/anime'
import { VirtualListLayout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { pickStoredTitle } from '@/lib/contentPreferences'
import { formatRelativeTime, padEpisode } from '@/lib/format'
import type { RootStackParamList } from '@/navigation/types'
import { selectContinueWatching, useHistoryStore } from '@/stores/historyStore'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function HistoryPage() {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()

  const entries = useHistoryStore((s) => s.entries)
  const clear = useHistoryStore((s) => s.clear)
  const removeEntry = useHistoryStore((s) => s.removeEntry)
  const [confirmClear, setConfirmClear] = useState(false)

  const sorted = useMemo(() => selectContinueWatching(entries), [entries])

  return (
    <VirtualListLayout
      data={sorted}
      empty={
        <EmptyState
          title={t('history.emptyTitle')}
          description={t('history.emptyDesc')}
          icon={<HistoryIcon size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
        />
      }
      header={<PageHeader count={sorted.length} onClear={() => setConfirmClear(true)} />}
      keyExtractor={(entry) => `${entry.animeId}-${entry.episode}`}
      overlay={
        <Dialog
          open={confirmClear}
          onClose={() => setConfirmClear(false)}
          title={t('history.clearTitle')}
          description={t('history.clearDesc', { count: entries.length })}>
          <Button variant="outline" onPress={() => setConfirmClear(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onPress={() => {
              clear()
              setConfirmClear(false)
            }}>
            {t('history.clearAction')}
          </Button>
        </Dialog>
      }
      renderItem={(entry) => (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('common.openAria', {
              title: entry.titleEnglish ?? entry.title,
            })}
            onPress={() => navigation.navigate('AnimeDetail', { malId: entry.animeId })}
            style={({ pressed }) => [styles.posterButton, pressed && styles.posterPressed]}>
            <SafeImage
              src={entry.posterUrl}
              alt=""
              aspectRatio={2 / 3}
              style={styles.poster}
            />
          </Pressable>

          <View style={styles.body}>
            {/* Title takes the row; the remove action trails at the top. */}
            <View style={styles.titleRow}>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  navigation.navigate('AnimeDetail', { malId: entry.animeId })
                }
                style={styles.titleLink}>
                <Text numberOfLines={1} style={styles.rowTitle}>
                  {pickStoredTitle(entry)}
                </Text>
              </Pressable>
              <Button
                variant="ghost"
                size="iconSm"
                accessibilityLabel={t('history.removeAria', { title: entry.title })}
                onPress={() => removeEntry(entry.animeId)}>
                <Trash2 size={15} color={colors.foreground} strokeWidth={1.6} />
              </Button>
            </View>

            <Text style={styles.episode}>
              {t('common.episode', { num: padEpisode(entry.episode) })}
              {entry.episodeTitle ? ` · ${entry.episodeTitle}` : ''}
            </Text>

            <View style={styles.metaRow}>
              <Text style={styles.meta}>{formatRelativeTime(entry.lastWatchedAt)}</Text>
              {typeof entry.progress === 'number' && entry.progress > 0 ? (
                <Text style={styles.meta}>
                  {t('history.progress', { percent: Math.round(entry.progress) })}
                </Text>
              ) : null}
              {entry.totalEpisodes ? (
                <Text style={styles.meta}>
                  {entry.episode}/{entry.totalEpisodes}
                </Text>
              ) : null}
            </View>

            {typeof entry.progress === 'number' && entry.progress > 0 ? (
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={t('a11y.watchProgressFor', { title: entry.title })}
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

            {/* Primary action spans the card's bottom edge, trailing. */}
            <View style={styles.ctaRow}>
              <Button
                size="sm"
                onPress={() =>
                  navigation.navigate('Watch', {
                    malId: entry.animeId,
                    episode: entry.episode,
                  })
                }>
                <Play size={13} color={colors.primaryForeground} strokeWidth={1.6} />
                <Text style={styles.ctaLabel}>{t('common.continue')}</Text>
                <ChevronRight size={13} color={colors.primaryForeground} strokeWidth={1.6} />
              </Button>
            </View>
          </View>
        </View>
      )}
    />
  )
}

function PageHeader({ count, onClear }: { count: number; onClear: () => void }) {
  const { t } = useTranslation()
  return (
    <View style={styles.header}>
      <View style={styles.headerTitles}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('nav.history')}
        </Text>
        <Text style={styles.subtitle}>
          {count > 0 ? t('history.subtitleCount', { count }) : t('history.subtitleEmpty')}
        </Text>
      </View>
      {count > 0 ? (
        <Button variant="ghost" size="sm" onPress={onClear}>
          <Trash2 size={14} color={colors.foreground} strokeWidth={1.6} />
          <Text style={styles.ghostLabel}>{t('common.clear')}</Text>
        </Button>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
  },
  posterButton: { flexShrink: 0 },
  posterPressed: { opacity: 0.72 },
  /** Larger poster (`w-14`) with the card's own corner scale. */
  poster: { width: 56, borderRadius: radii.md, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleLink: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  /** `font-mono text-[0.7rem] text-muted-foreground` — not uppercased. */
  episode: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  /** `font-mono text-[0.65rem] text-muted-foreground` — not uppercased. */
  meta: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  /**
   * Full-width track in a tonal step above the card — `colors.muted` is the
   * card's own background, so the old track was invisible except for the fill.
   */
  progressTrack: {
    height: 3,
    width: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerHighest,
    marginTop: spacing.half,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },

  ctaRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: spacing.xs },
  /** Label on the white (default-variant) Continue button. */
  ctaLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.primaryForeground,
  },
  /** Label on the ghost Clear button. */
  ghostLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
})
