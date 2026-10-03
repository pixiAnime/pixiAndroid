/**
 * EpisodeList — number, title, air date, watched & selected states.
 * Episode metadata comes from the episode provider (via `useEpisodes`);
 * watched state comes from the local history store.
 *
 * The web list is a `<ul>` that is always mounted and lets the DOM's
 * `scrollIntoView({block: 'nearest'})` keep the current row in view. RN has
 * no equivalent call, so every row reports its box through `onLayout` and this
 * component scrolls the same "nearest" distance itself: nothing moves unless
 * the selected row is actually below the fold, and a plain `ScrollView` (not
 * a `FlatList`) is used deliberately so it can live inside the page's own
 * scroll view without a nested-VirtualizedList warning.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Check } from '@/components/icons'

import { formatDate, padEpisode } from '@/lib/format'
import type { Episode } from '@/providers/episode'
import { colors, fonts, radii, spacing, text } from '@/theme'

/** `max-h-[26rem]` — the web's episode scroll box, in density-independent px. */
const LIST_MAX_HEIGHT = 416

interface RowBox {
  y: number
  height: number
}

interface EpisodeListProps {
  episodes: Episode[]
  currentEpisode: number
  watched: Set<number>
  onSelect: (episodeNumber: number) => void
  isLoading?: boolean
}

export function EpisodeList({
  episodes,
  currentEpisode,
  watched,
  onSelect,
  isLoading,
}: EpisodeListProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const boxesRef = useRef(new Map<number, RowBox>())
  /** Bumped when the *selected* row lays out, so the scroll check re-runs. */
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  const currentEpisodeRef = useRef(currentEpisode)
  currentEpisodeRef.current = currentEpisode

  const items = useMemo(
    () =>
      [...episodes]
        .sort((a, b) => a.number - b.number)
        .map((episode) => ({
          ...episode,
          isWatched: watched.has(episode.number),
          isSelected: episode.number === currentEpisode,
        })),
    [episodes, watched, currentEpisode],
  )

  // Keep the active episode scrolled into view — `scrollIntoView(block:'nearest')`.
  useEffect(() => {
    const box = boxesRef.current.get(currentEpisode)
    if (!box) return
    if (box.y + box.height <= LIST_MAX_HEIGHT) return // already visible
    scrollRef.current?.scrollTo({
      y: box.y + box.height - LIST_MAX_HEIGHT,
      animated: false,
    })
  }, [currentEpisode, layoutEpoch])

  const noteLayout = (episodeNumber: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout
    boxesRef.current.set(episodeNumber, { y, height })
    if (episodeNumber === currentEpisodeRef.current) {
      setLayoutEpoch((epoch) => epoch + 1)
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.mutedForeground} size="small" />
        <Text style={styles.loadingText}>{t('common.loadingEpisodes')}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      ref={scrollRef}
      accessibilityLabel={t('watch.episodes')}
      accessibilityRole="list"
      contentContainerStyle={styles.listContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={styles.list}>
      {items.map((episode) => (
        <PressableRow
          episode={episode}
          key={episode.number}
          noteLayout={noteLayout}
          onSelect={onSelect}
          title={
            episode.title
              ? episode.title
              : t('common.episode', { num: padEpisode(episode.number) })
          }
        />
      ))}
    </ScrollView>
  )
}

function PressableRow({
  episode,
  title,
  onSelect,
  noteLayout,
}: {
  episode: Episode & { isWatched: boolean; isSelected: boolean }
  title: string
  onSelect: (episodeNumber: number) => void
  noteLayout: (episodeNumber: number, event: LayoutChangeEvent) => void
}) {
  const { t } = useTranslation()
  const selected = episode.isSelected

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onLayout={(event) => noteLayout(episode.number, event)}
      onPress={() => onSelect(episode.number)}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && !selected && styles.rowPressed,
      ]}>
      {/* number / watched — `aria-hidden` on the web too (the row says it) */}
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[
          styles.badge,
          selected ? styles.badgeSelected : episode.isWatched ? styles.badgeWatched : null,
        ]}>
        {episode.isWatched && !selected ? (
          <Check color={colors.foreground} size={14} strokeWidth={1.8} />
        ) : (
          <Text
            style={[
              styles.badgeText,
              selected
                ? styles.badgeTextSelected
                : episode.isWatched
                  ? styles.badgeTextWatched
                  : styles.badgeTextIdle,
            ]}>
            {padEpisode(episode.number)}
          </Text>
        )}
      </View>

      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {title}
          {episode.filler ? (
            <Text style={styles.rowFlag}> {t('player.filler')}</Text>
          ) : null}
          {episode.recap ? <Text style={styles.rowFlag}> {t('player.recap')}</Text> : null}
        </Text>
        <Text style={styles.rowMeta}>
          {episode.airDate
            ? formatDate(episode.airDate)
            : t('common.episode', { num: padEpisode(episode.number) })}
          {episode.isWatched && !selected ? ` · ${t('player.watched')}` : ''}
        </Text>
      </View>

      {/* state by shape, not only colour */}
      {selected ? <Text style={styles.nowLabel}>{t('player.now')}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  /** `max-h-[26rem] overflow-y-auto pr-1` */
  list: { maxHeight: LIST_MAX_HEIGHT },
  listContent: { paddingRight: spacing.xs },
  /** `flex items-center justify-center gap-2 py-8` */
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loadingText: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.mutedForeground },

  /** `group flex w-full items-center gap-3 border-b px-2 py-2.5` */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  rowSelected: { backgroundColor: colors.surfaceContainerHigh },
  rowPressed: { backgroundColor: 'rgba(25,25,25,0.5)' },

  /** `flex size-7 shrink-0 items-center justify-center border font-mono text-[0.7rem]` */
  badge: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.none,
  },
  badgeSelected: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  badgeWatched: { backgroundColor: colors.muted },
  badgeText: { fontFamily: fonts.mono, fontSize: 11.2, lineHeight: 16, fontVariant: ['tabular-nums'] },
  badgeTextSelected: { color: colors.background },
  badgeTextWatched: { color: colors.foreground },
  badgeTextIdle: { color: colors.mutedForeground },

  rowBody: { flex: 1, minWidth: 0 },
  /** `block truncate text-xs text-foreground` */
  rowTitle: { ...text.bodySm, lineHeight: 16, color: colors.foreground },
  /** `ml-1.5 font-mono text-[0.6rem] text-muted-foreground uppercase` */
  rowFlag: { fontFamily: fonts.mono, fontSize: 9.6, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `mt-0.5 font-mono text-[0.6rem] text-muted-foreground` — not uppercased. */
  rowMeta: { fontFamily: fonts.mono, fontSize: 9.6, lineHeight: 14, letterSpacing: 0.5, color: colors.mutedForeground, marginTop: spacing.half },
  /** `font-mono text-[0.6rem] tracking-wide text-foreground uppercase` */
  nowLabel: { fontFamily: fonts.mono, fontSize: 9.6, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.foreground },
})
