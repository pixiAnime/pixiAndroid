/**
 * `IconButton` — Material 3 icon button.
 *
 * A compact, typically circular target for a single icon. Variants mirror the
 * button emphasis levels; sizes stay at or above the 40px M3 floor.
 */
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radii } from '@/theme'

export type IconButtonVariant = 'standard' | 'filled' | 'tonal' | 'outlined'
export type IconButtonSize = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  variant?: IconButtonVariant
  size?: IconButtonSize
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

const SIZES: Record<IconButtonSize, number> = { sm: 40, md: 44, lg: 48 }

export function IconButton({
  variant = 'standard',
  size = 'md',
  style,
  children,
  disabled,
  ...rest
}: IconButtonProps) {
  const tone = VARIANTS[variant]
  const dimension = SIZES[size]

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          width: dimension,
          height: dimension,
          borderRadius: radii.pill,
          backgroundColor: tone.bg,
          borderWidth: tone.border === 'transparent' ? 0 : 1,
          borderColor: tone.border,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {children}
    </Pressable>
  )
}

const VARIANTS: Record<IconButtonVariant, { bg: string; border: string }> = {
  standard: { bg: 'transparent', border: 'transparent' },
  filled: { bg: colors.primary, border: 'transparent' },
  tonal: { bg: colors.secondaryContainer, border: 'transparent' },
  outlined: { bg: 'transparent', border: colors.outline },
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.38 },
})
