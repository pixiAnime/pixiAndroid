/**
 * `Badge` — Material 3 chip.
 *
 * A pill with a 32px height, label-medium type, and tonal/outlined surfaces.
 * Used for the extension capability and status chips, and for filter tags.
 */
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

import { colors, radii, spacing, text } from '@/theme'

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost'

export interface BadgeProps {
  variant?: BadgeVariant
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  onPress?: () => void
  /** Kept for `aria-pressed` parity with the web chips. */
  active?: boolean
  children: string
}

export function Badge({ variant = 'default', style, textStyle, onPress, children }: BadgeProps) {
  const tone = VARIANTS[variant]
  const content = (
    <Text
      numberOfLines={1}
      style={[styles.label, { backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }, textStyle]}>
      {children}
    </Text>
  )

  if (!onPress) return content
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {content}
    </Pressable>
  )
}

const VARIANTS: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, border: 'transparent' },
  secondary: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, border: 'transparent' },
  destructive: { bg: colors.errorContainer, fg: colors.onErrorContainer, border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.onSurfaceVariant, border: colors.outline },
  ghost: { bg: 'transparent', fg: colors.onSurfaceVariant, border: 'transparent' },
}

const styles = StyleSheet.create({
  label: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    height: 32,
    lineHeight: 30,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    fontFamily: text.labelMedium.fontFamily,
    fontSize: 12,
    textAlignVertical: 'center',
  },
})
