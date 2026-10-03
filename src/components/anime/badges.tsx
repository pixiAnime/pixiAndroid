/** Small badges: score, type, status — monochrome, sharp. */
import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Star } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { formatScore } from '@/lib/format'
import { colors, fonts, radii, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

/** `bg-background/85` — the chip sits over artwork, so it stays translucent. */
const SCORE_BG = colors.surfaceContainerHighest
const TAG_BG = colors.surfaceContainerHigh

interface ScoreBadgeProps {
  score?: number | null
  style?: StyleProp<ViewStyle>
}

export function ScoreBadge({ score, style }: ScoreBadgeProps) {
  const { t } = useTranslation()
  if (!score) return null
  const value = formatScore(score)

  return (
    <View
      accessible
      accessibilityLabel={`${value} ${t('common.score')}`}
      style={[styles.score, style]}>
      <Star color={colors.foreground} fill={colors.foreground} size={10} />
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  )
}

interface TagBadgeProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

export function TagBadge({ children, style }: TagBadgeProps) {
  return (
    <View style={[styles.tag, style]}>
      <Text style={styles.tagLabel}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  score: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: SCORE_BG,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.4,
    lineHeight: 15,
    color: colors.foreground,
  },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: TAG_BG,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  /** `font-mono text-[0.65rem] tracking-wide uppercase text-muted-foreground` */
  tagLabel: { ...text.monoSmall },
})
