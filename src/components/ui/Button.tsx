/**
 * `Button` — Material 3 button.
 *
 * M3 defines five emphasis levels; the web's shadcn variant names are kept as
 * aliases so every existing call site keeps working:
 *
 *   default      → filled (primary)
 *   secondary    → tonal (secondaryContainer)
 *   outline      → outlined
 *   ghost / link → text
 *   destructive  → filled error
 *
 * Geometry follows M3: a pill radius, fixed heights per size, and a light
 * *state layer* on press (a whole-button opacity dip — no shadows). Icon
 * children render as-is; plain-string children get the label type automatically.
 */
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radii, text } from '@/theme'

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'iconSm'

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant
  size?: ButtonSize
  style?: StyleProp<ViewStyle>
  /** Rendered after the label — used for trailing chevrons and counts. */
  accessory?: string
}

const HEIGHTS: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  default: { height: 44, paddingHorizontal: 20, fontSize: 14 },
  xs: { height: 32, paddingHorizontal: 12, fontSize: 12 },
  sm: { height: 40, paddingHorizontal: 16, fontSize: 13 },
  lg: { height: 48, paddingHorizontal: 24, fontSize: 15 },
  icon: { height: 44, paddingHorizontal: 0, fontSize: 14 },
  iconSm: { height: 40, paddingHorizontal: 0, fontSize: 13 },
}

export function Button({
  variant = 'default',
  size = 'default',
  style,
  accessory,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const metrics = HEIGHTS[size]
  const tone = VARIANTS[variant]

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: metrics.height,
          paddingHorizontal: metrics.paddingHorizontal,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderWidth: tone.border === 'transparent' ? 0 : 1,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {typeof children === 'string' ? (
        <Text
          numberOfLines={1}
          style={[styles.label, { fontSize: metrics.fontSize, color: tone.fg }, variant === 'link' && styles.linkLabel]}>
          {children}
          {accessory ? ` ${accessory}` : ''}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
  secondary: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, border: 'transparent' },
  outline: { bg: 'transparent', fg: colors.onSurface, border: colors.outline },
  ghost: { bg: 'transparent', fg: colors.onSurface, border: 'transparent' },
  destructive: { bg: colors.error, fg: colors.onError, border: 'transparent' },
  link: { bg: 'transparent', fg: colors.onSurface, border: 'transparent' },
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.pill,
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.38 },
  label: { ...text.labelLarge },
  linkLabel: { textDecorationLine: 'underline' },
})
