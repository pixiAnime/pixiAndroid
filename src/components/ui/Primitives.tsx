/**
 * Small layout primitives that the web takes from shadcn but that are trivial
 * in RN: `Separator` (1px rule) and `Skeleton` (pulse block), plus `Chip` —
 * the mono uppercase bordered square used for genre filters and detail tags
 * (`border px-2 py-1 font-mono text-[0.65rem] uppercase`).
 *
 * Note on pulses: RN has no `animate-pulse`, so `Skeleton` fades instead.
 * The geometry still matches the real content exactly (see `ROW_CARD_WIDTH`)
 * so nothing jumps when data arrives.
 */
import { Animated, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { useEffect, useRef } from 'react'
import { Pressable } from 'react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export function Separator({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.separator, style]} />
}

export function Skeleton({
  width,
  height = 16,
  radius = radii.md,
  style,
}: {
  width?: number | `${number}%`
  height?: number | `${number}%`
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: colors.muted, opacity }, style]}
    />
  )
}

export interface ChipProps extends Omit<PressableProps, 'style'> {
  active?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children: string
}

export function Chip({ active, disabled, style, children, ...rest }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active), disabled }}
      disabled={disabled}
      {...rest}
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
        style,
      ]}>
      <Text numberOfLines={1} style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  separator: { height: 1, backgroundColor: colors.border, width: '100%' },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.none,
  },
  chipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  chipDisabled: { opacity: 0.6 },
  chipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  chipLabelActive: { color: colors.background },
})
