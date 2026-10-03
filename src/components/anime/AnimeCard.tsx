/**
 * AnimeCard — poster + title + meta. Opens the detail screen.
 * Used in rows, grids, search results, recommendations, lists.
 */
import { useContext, useId } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { NavigationContainerRefContext } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import type { JikanAnime } from '@/api/jikan/types'
import { colors, fonts, spacing, text } from '@/theme'

import { SafeImage } from './SafeImage'
import { ScoreBadge } from './badges'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

interface AnimeCardProps {
  anime: JikanAnime
  /** Merged onto the root — the port of the web `className`. */
  style?: StyleProp<ViewStyle>
  /** Show rank number (top lists). */
  rank?: number
  /** Eager-load above-the-fold cards (web hint — kept for API parity). */
  priority?: boolean
  /** Overrides the default `AnimeDetail` navigation. */
  onPress?: () => void
}

export function AnimeCard({ anime, style, rank, priority, onPress }: AnimeCardProps) {
  const { t } = useTranslation()
  const title = anime.title_english ?? anime.title
  const navigation = useContext(NavigationContainerRefContext)
  const scrimId = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const poster = anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url

  const handlePress =
    onPress ??
    (() => {
      // No container yet (the shell mounts one later) → tap is a no-op.
      if (navigation?.isReady()) {
        navigation.navigate('AnimeDetail', { malId: anime.mal_id })
      }
    })

  return (
    <Pressable
      accessibilityLabel={`${title}${anime.title_japanese ? ` (${anime.title_japanese})` : ''}`}
      accessibilityRole="link"
      onPress={handlePress}
      style={[styles.root, style]}>
      {/* Hover emphasis becomes a pressed state on a touch-only target. */}
      {({ pressed }) => (
        <>
          <View style={[styles.poster, pressed && styles.posterActive]}>
            <SafeImage alt={t('common.posterAlt', { title })} priority={priority} src={poster} />
            {pressed ? (
              <>
                {/* hover scrim — sits under the badge */}
                <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
                  <Defs>
                    <LinearGradient id={scrimId} x1={0} x2={0} y1={1} y2={0}>
                      <Stop offset="0" stopColor={colors.background} stopOpacity={0.6} />
                      <Stop offset="0.5" stopColor={colors.background} stopOpacity={0} />
                      <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  <Rect fill={`url(#${scrimId})`} height="100%" width="100%" />
                </Svg>
                <View style={styles.scoreRow}>
                  <ScoreBadge score={anime.score} />
                </View>
              </>
            ) : null}
            {rank !== undefined ? (
              <View style={styles.rank}>
                <Text style={styles.rankText}>{String(rank).padStart(2, '0')}</Text>
              </View>
            ) : null}
            {anime.airing ? (
              <View style={styles.airing}>
                <Text style={styles.airingText}>airing</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaBlock}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{anime.type ?? 'TV'}</Text>
              <Text importantForAccessibility="no" style={styles.metaText}>
                ·
              </Text>
              <Text style={styles.metaText}>
                {anime.episodes ? `${anime.episodes} eps` : '—'}
              </Text>
            </View>
          </View>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flexDirection: 'column', gap: spacing.sm },
  poster: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  /** `group-hover:border-foreground/30` */
  posterActive: { borderColor: 'rgba(252,252,252,0.3)' },
  scoreRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: spacing.s1_5,
  },
  rank: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(10,10,10,0.9)',
    paddingHorizontal: spacing.s1_5,
    paddingVertical: spacing.half,
  },
  rankText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  airing: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(10,10,10,0.9)',
    paddingHorizontal: spacing.s1_5,
    paddingVertical: spacing.half,
  },
  airingText: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.foreground,
  },
  metaBlock: { flexDirection: 'column', gap: spacing.half, minWidth: 0 },
  title: { ...text.cardTitle, color: colors.foreground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s1_5 },
  metaText: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
})
