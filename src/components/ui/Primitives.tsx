/**
 * Small primitives: `Separator` (1px rule), `Skeleton` (subtle pulse block)
 * and `Chip` (Material 3 filter chip).
 *
 * `Skeleton` keeps the exact geometry of the real content it stands in for, so
 * nothing jumps when data arrives. RN has no `animate-pulse`, so it fades on a
 * gentle loop rather than shimmering.
 */
import { useEffect, useState } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { colors, radii, spacing, text } from '@/theme'

export function Separator({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.separator, style]} />
}

/**
 * One native-driven pulse shared by every skeleton on screen.
 *
 * A per-skeleton `Animated.loop` meant Home's cold load ran ~190 loops
 * (8 rows × 8 cards × 3 blocks each), each scheduling JS restart callbacks
 * during the exact frames the JS thread is busiest with query results and
 * mounts. One loop animating one value that all skeletons read is O(1) and
 * visually identical — the web's `animate-pulse` is synchronized too.
 * Reference-counted so it stops when the last skeleton unmounts.
 */
let pulseValue: Animated.Value | undefined
let pulseLoop: Animated.CompositeAnimation | undefined
let pulseUsers = 0

function retainPulse(): Animated.Value {
  if (!pulseValue) {
    const value = new Animated.Value(0.5)
    pulseValue = value
    pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.9, duration: 800, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    )
  }
  pulseUsers += 1
  if (pulseUsers === 1) pulseLoop?.start()
  return pulseValue
}

function releasePulse() {
  pulseUsers = Math.max(0, pulseUsers - 1)
  if (pulseUsers === 0) pulseLoop?.stop()
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
  // Retained once per mount so the first frame already animates; released on
  // unmount (the app has no StrictMode double-invocation to compensate for).
  const [opacity] = useState<Animated.Value>(retainPulse)

  useEffect(() => () => releasePulse(), [])

  return (
    <Animated.View
      style={[
        { width: width ?? '100%', height, borderRadius: radius, backgroundColor: colors.surfaceContainerHigh, opacity },
        style,
      ]}
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
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled, style]}>
      <Text numberOfLines={1} style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {children}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  separator: { height: 1, backgroundColor: colors.outlineVariant, width: '100%' },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  chipActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.secondaryContainer },
  chipDisabled: { opacity: 0.38 },
  chipLabel: { ...text.labelMedium, color: colors.onSurfaceVariant },
  chipLabelActive: { color: colors.onSecondaryContainer },
})
