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
import { ChevronRight, History as HistoryIcon, Play, Trash2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { SafeImage } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { formatRelativeTime, padEpisode } from '@/lib/format'
import type { RootStackParamList } from '@/navigation/types'
import { selectContinueWatching, useHistoryStore } from '@/stores/historyStore'
import { colors, fonts, spacing, text } from '@/theme'

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
    <ScreenLayout contentStyle={styles.page}>
      {/* `space-y-6` stack from the web page */}
      <View style={styles.stack}>
        <PageHeader count={sorted.length} onClear={() => setConfirmClear(true)} />

        {sorted.length === 0 ? (
          <EmptyState
            title={t('history.emptyTitle')}
            description={t('history.emptyDesc')}
            icon={<HistoryIcon size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
          />
        ) : (
          <View style={styles.list}>
            {sorted.map((entry) => (
              <View key={entry.animeId} style={styles.row}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('common.openAria', {
                    title: entry.titleEnglish ?? entry.title,
                  })}
                  onPress={() => navigation.navigate('AnimeDetail', { malId: entry.animeId })}
                  style={styles.posterButton}>
                  <SafeImage
                    src={entry.posterUrl}
                    alt=""
                    aspectRatio={2 / 3}
                    style={styles.poster}
                  />
                </Pressable>

                <View style={styles.body}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      navigation.navigate('AnimeDetail', { malId: entry.animeId })
                    }>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {entry.titleEnglish ?? entry.title}
                    </Text>
                  </Pressable>

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
                </View>

                <View style={styles.actions}>
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
                  <Button
                    variant="ghost"
                    size="iconSm"
                    accessibilityLabel={t('history.removeAria', { title: entry.title })}
                    onPress={() => removeEntry(entry.animeId)}>
                    <Trash2 size={15} color={colors.foreground} strokeWidth={1.6} />
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

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
    </ScreenLayout>
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
  page: { gap: 40 },
  /** Web page root is `space-y-6`. */
  stack: { gap: spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  posterButton: { flexShrink: 0 },
  /** `w-12` on a phone (`sm:w-14` never applies here). */
  poster: { width: 48, borderWidth: 1, borderColor: colors.border },
  body: { flex: 1, minWidth: 0 },
  rowTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  /** `font-mono text-[0.7rem] text-muted-foreground` — not uppercased. */
  episode: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
    marginTop: spacing.half,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginTop: spacing.s1_5,
  },
  /** `font-mono text-[0.65rem] text-muted-foreground` — not uppercased. */
  meta: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  /** `h-0.5 w-full max-w-xs bg-muted` */
  progressTrack: {
    height: 2,
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.muted,
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: colors.foreground },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.s1_5, flexShrink: 0 },
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
