/**
 * `Card` — Material 3 surface container.
 *
 * A tonal neutral panel (`surfaceContainer`) with a 12px radius and optional
 * interactivity (a pressed state layer). No shadows or gradients — depth comes
 * from the surface tone alone.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radii, spacing } from '@/theme'

export interface CardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link' | 'none'
}

export function Card({ children, onPress, style, accessibilityLabel, accessibilityRole = 'button' }: CardProps) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>
  }
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.9 },
})
