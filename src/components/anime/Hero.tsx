/**
 * Hero — featured anime with large artwork, meta, genres, actions.
 * Functional scrim only (no decorative gradients): text needs contrast.
 *
 * Breakpoints: the web's `sm:` (640) and `lg:` (1024) tiers are reproduced
 * with `useWindowDimensions`, because a phone in landscape (or a tablet) is
 * exactly where those media queries would start applying.
 *
 * RN has no CSS gradients and `react-native-linear-gradient` is not
 * installed, so every `bg-linear-to-*` scrim is drawn with
 * `react-native-svg`'s `LinearGradient` over `StyleSheet.absoluteFill`.
 */
import { memo, useContext, useId } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { NavigationContainerRefContext } from '@react-navigation/native'
import { Info, Play, Star } from '@/components/icons'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import type { JikanAnime } from '@/api/jikan/types'
import { Button } from '@/components/ui/Button'
import { formatDate, formatScore } from '@/lib/format'
import { colors, fonts, radii, spacing, text } from '@/theme'

import { SafeImage } from './SafeImage'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

interface HeroProps {
  anime: JikanAnime
  /** Merged onto the root — the port of the web `className`. */
  style?: StyleProp<ViewStyle>
  /** Title / "Details" navigation override (web: `/anime/:id`). */
  onPress?: () => void
  /** "Watch now" navigation override (web: `/watch/:id/1`). */
  onWatchPress?: () => void
}

/** Tailwind `sm:` / `lg:`. */
const SM_BREAKPOINT = 640
const LG_BREAKPOINT = 1024

interface ScrimStop {
  offset: string
  color: string
  opacity: number
}

/** `bg-linear-to-r from-background via-background/80 to-transparent` */
const HORIZON_STOPS: ScrimStop[] = [
  { offset: '0', color: colors.background, opacity: 1 },
  { offset: '0.5', color: colors.background, opacity: 0.8 },
  { offset: '1', color: colors.background, opacity: 0 },
]

/** `bg-linear-to-t from-background/90 via-transparent to-background/40` */
const WIDE_STOPS: ScrimStop[] = [
  { offset: '0', color: colors.background, opacity: 0.9 },
  { offset: '0.5', color: colors.background, opacity: 0 },
  { offset: '1', color: colors.background, opacity: 0.4 },
]

/** `bg-linear-to-t from-background via-background/85 to-background/50` */
const MOBILE_STOPS: ScrimStop[] = [
  { offset: '0', color: colors.background, opacity: 1 },
  { offset: '0.5', color: colors.background, opacity: 0.85 },
  { offset: '1', color: colors.background, opacity: 0.5 },
]

function Scrim({
  id,
  axis,
  stops,
}: {
  id: string
  axis: { x1: number; y1: number; x2: number; y2: number }
  stops: ScrimStop[]
}) {
  return (
    <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
      <Defs>
        <LinearGradient id={id} x1={axis.x1} y1={axis.y1} x2={axis.x2} y2={axis.y2}>
          {stops.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" />
    </Svg>
  )
}

/**
 * Memoized: Home re-renders on every query notification; `anime` is the
 * query-cache object, so the hero (two SVG scrims + image + actions) is
 * skipped unless the featured item actually changed.
 */
export const Hero = memo(function Hero({ anime, style, onPress, onWatchPress }: HeroProps) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const wide = width >= SM_BREAKPOINT
  const extraWide = width >= LG_BREAKPOINT
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const navigation = useContext(NavigationContainerRefContext)

  const title = anime.title_english ?? anime.title
  const synopsis =
    anime.synopsis?.replace(/\[Written by MAL Rewrite\]|\s+/g, ' ').trim() ?? ''
  const shortSynopsis =
    synopsis.length > 320 ? `${synopsis.slice(0, 320).trimEnd()}…` : synopsis
  const jpTitle = anime.title_japanese
  const genres = (anime.genres ?? []).slice(0, 5)
  const poster = anime.images?.webp?.large_image_url ?? anime.images?.jpg?.large_image_url

  // The shell mounts a NavigationContainer later; without one these are no-ops.
  const goDetail = () => {
    if (onPress) return onPress()
    if (navigation?.isReady()) navigation.navigate('AnimeDetail', { malId: anime.mal_id })
  }
  const goWatch = () => {
    if (onWatchPress) return onWatchPress()
    if (navigation?.isReady()) navigation.navigate('Watch', { malId: anime.mal_id, episode: 1 })
  }

  return (
    <View style={[styles.root, wide && styles.rootWide, style]}>
      {wide ? (
        /* artwork — right-anchored (web: `sm:block`) */
        <View style={styles.artWide}>
          <SafeImage alt="" fill priority src={poster} />
          <Scrim axis={{ x1: 0, y1: 0, x2: 1, y2: 0 }} id={`${uid}h`} stops={HORIZON_STOPS} />
          <Scrim axis={{ x1: 0, y1: 1, x2: 0, y2: 0 }} id={`${uid}v`} stops={WIDE_STOPS} />
        </View>
      ) : (
        /* mobile: artwork as background with heavy scrim */
        <View style={styles.artMobile}>
          <SafeImage alt="" fill priority src={poster} style={styles.artDim} />
          <Scrim axis={{ x1: 0, y1: 1, x2: 0, y2: 0 }} id={`${uid}m`} stops={MOBILE_STOPS} />
        </View>
      )}

      <View style={[styles.content, wide && styles.contentWide, extraWide && styles.contentMax]}>
        {/* kicker */}
        <View style={styles.kicker}>
          <View style={styles.kickerBadge}>
            <Text style={styles.kickerBadgeText}>{t('hero.featured')}</Text>
          </View>
          {anime.type ? <Text style={styles.kickerText}>{anime.type}</Text> : null}
          {anime.season && anime.year ? (
            <>
              <Text importantForAccessibility="no" style={styles.kickerText}>
                ·
              </Text>
              <Text style={styles.kickerTextStrong}>{`${anime.season} ${anime.year}`}</Text>
            </>
          ) : null}
          {anime.aired?.from ? (
            <>
              <Text importantForAccessibility="no" style={styles.kickerText}>
                ·
              </Text>
              <Text style={styles.kickerText}>
                {formatDate(anime.aired.from, { year: 'numeric' })}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <View accessibilityRole="header" style={styles.titleLink}>
            <Pressable accessibilityRole="link" onPress={goDetail}>
              {({ pressed }) => (
                <Text
                  style={[
                    styles.title,
                    wide && styles.titleWide,
                    extraWide && styles.titleExtraWide,
                    pressed && styles.titlePressed,
                  ]}>
                  {title}
                </Text>
              )}
            </Pressable>
          </View>
          {jpTitle && jpTitle !== title ? (
            <Text style={styles.jpTitle}>{jpTitle}</Text>
          ) : null}
        </View>

        {shortSynopsis ? <Text style={styles.synopsis}>{shortSynopsis}</Text> : null}

        {/* meta row */}
        <View style={styles.metaRow}>
          {anime.score ? (
            <View style={styles.score}>
              <Star color={colors.foreground} fill={colors.foreground} size={12} />
              <Text style={styles.scoreText}>{formatScore(anime.score)}</Text>
            </View>
          ) : null}
          {anime.episodes ? (
            <>
              <Text importantForAccessibility="no" style={styles.metaText}>
                ·
              </Text>
              <Text style={styles.metaText}>{t('hero.episodes', { count: anime.episodes })}</Text>
            </>
          ) : null}
          {anime.rating ? (
            <>
              <Text importantForAccessibility="no" style={styles.metaText}>
                ·
              </Text>
              <Text style={styles.metaText}>{anime.rating.split(' - ')[0]}</Text>
            </>
          ) : null}
          {anime.aired?.string ? (
            <>
              <Text importantForAccessibility="no" style={styles.metaText}>
                ·
              </Text>
              <Text style={styles.metaText}>{anime.aired.string}</Text>
            </>
          ) : null}
        </View>

        {genres.length > 0 ? (
          <View accessibilityLabel={t('a11y.genres')} accessibilityRole="list" style={styles.genres}>
            {genres.map((genre) => (
              <View key={genre.mal_id} style={styles.genre}>
                <Text style={styles.genreText}>{genre.name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button onPress={goWatch} size="lg" variant="default">
            <Play color={colors.primaryForeground} size={16} />
            <Text style={styles.actionLabelInverted}>{t('common.watchNow')}</Text>
          </Button>
          <Button onPress={goDetail} size="lg" variant="outline">
            <Info color={colors.foreground} size={16} />
            <Text style={styles.actionLabel}>{t('common.details')}</Text>
          </Button>
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    minHeight: 480, // `min-h-[30rem]`
  },
  rootWide: { minHeight: 544 }, // `sm:min-h-[34rem]`
  artWide: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '62%' },
  artMobile: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  artDim: { opacity: 0.4 },
  content: {
    position: 'relative',
    minHeight: 480,
    justifyContent: 'flex-end',
    gap: spacing.lg,
    padding: spacing.xl, // `p-6`
  },
  contentWide: { minHeight: 544, padding: 40 }, // `sm:p-10`
  contentMax: { maxWidth: '58%' }, // `lg:max-w-[58%]`
  kicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kickerBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  kickerText: { ...text.monoSmall },
  kickerBadgeText: { ...text.monoSmall, color: colors.foreground },
  kickerTextStrong: { ...text.monoSmall, textTransform: 'capitalize' },
  titleBlock: { gap: spacing.s1_5 },
  titleLink: { alignSelf: 'flex-start' },
  title: { ...text.heroTitle, color: colors.foreground },
  titleWide: { fontSize: 30, lineHeight: 38 }, // `sm:text-3xl` + `leading-tight`
  titleExtraWide: { fontSize: 36, lineHeight: 45 }, // `lg:text-4xl`
  titlePressed: { textDecorationLine: 'underline' },
  jpTitle: { ...text.body, color: colors.mutedForeground },
  synopsis: { ...text.body, color: colors.mutedForeground, maxWidth: 576 }, // `max-w-xl`
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.sm,
  },
  score: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...text.meta, fontFamily: fonts.mono },
  scoreText: { ...text.meta, fontFamily: fonts.mono, color: colors.foreground },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  genre: {
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  genreText: { ...text.monoSmall, color: colors.foreground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  /** Button label, reproduced because `Button` only styles string children. */
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
  /** `variant="default"` is white-on-black, so the label inverts with it. */
  actionLabelInverted: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.primaryForeground,
  },
})
