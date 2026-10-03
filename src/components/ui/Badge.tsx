/**
 * `Badge` — the port of `src/components/ui/badge.tsx`.
 * `h-5 rounded-4xl px-2 text-xs font-medium` → 20px tall, 5.2px radius.
 */
import { StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { Pressable } from 'react-native'

import { colors, fonts, radii } from '@/theme'

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
  default: { bg: colors.primary, fg: colors.primaryForeground, border: 'transparent' },
  secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: 'transparent' },
  destructive: { bg: colors.destructive, fg: '#ffffff', border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.foreground, border: colors.input },
  ghost: { bg: 'transparent', fg: colors.mutedForeground, border: 'transparent' },
}

const styles = StyleSheet.create({
  label: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    height: 20,
    lineHeight: 18,
    paddingHorizontal: 8,
    borderRadius: radii.badge,
    borderWidth: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlignVertical: 'center',
  },
})
