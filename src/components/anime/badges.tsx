/** Small badges: score, type, status — monochrome, sharp. */
import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Star } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { formatScore } from '@/lib/format'
import { colors, fonts, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

/** `bg-background/85` — the chip sits over artwork, so it stays translucent. */
const SCORE_BG = 'rgba(10,10,10,0.85)'
/** `bg-muted/60` */
const TAG_BG = 'rgba(25,25,25,0.6)'

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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: SCORE_BG,
    paddingHorizontal: spacing.s1_5,
    paddingVertical: spacing.half,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: TAG_BG,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.half,
  },
  /** `font-mono text-[0.65rem] tracking-wide uppercase text-muted-foreground` */
  tagLabel: { ...text.monoSmall },
})
