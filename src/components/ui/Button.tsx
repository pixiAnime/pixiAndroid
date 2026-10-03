/**
 * `Button` — the port of `src/components/ui/button.tsx`.
 *
 * The web primitive is a shadcn button with `variant` / `size` and an
 * `asChild` mode; RN has no slot prop, so links are expressed as
 * `onPress={() => navigation.navigate(...)}` or by wrapping a `Pressable`.
 *
 * Visual rules preserved from the web:
 *  - `default` is *white on black* (`--primary` is the foreground colour) —
 *    there is no chromatic accent anywhere in the system;
 *  - radius is `rounded-lg` = 2px, not a pill;
 *  - heights are fixed per size (32 / 24 / 28 / 36) so buttons line up
 *    inside a row without `alignItems` tricks;
 *  - `active:translate-y-px` becomes a 1px pressed offset.
 */
import { Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

import { colors, fonts, radii } from '@/theme'

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
  default: { height: 32, paddingHorizontal: 16, fontSize: 14 },
  xs: { height: 24, paddingHorizontal: 8, fontSize: 12 },
  sm: { height: 28, paddingHorizontal: 10, fontSize: 12 },
  lg: { height: 36, paddingHorizontal: 20, fontSize: 14 },
  icon: { height: 32, paddingHorizontal: 0, fontSize: 14 },
  iconSm: { height: 28, paddingHorizontal: 0, fontSize: 12 },
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
        { height: metrics.height, paddingHorizontal: metrics.paddingHorizontal, backgroundColor: tone.bg, borderColor: tone.border },
        tone.radius && styles.rounded,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {typeof children === 'string' ? (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { fontSize: metrics.fontSize, color: tone.fg },
            variant === 'link' && styles.linkLabel,
          ]}>
          {children}
          {accessory ? ` ${accessory}` : ''}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const VARIANTS: Record<
  ButtonVariant,
  { bg: string; fg: string; border: string; radius: boolean }
> = {
  default: { bg: colors.primary, fg: colors.primaryForeground, border: 'transparent', radius: true },
  outline: { bg: 'transparent', fg: colors.foreground, border: colors.input, radius: true },
  secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: 'transparent', radius: true },
  ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent', radius: true },
  destructive: { bg: colors.destructive, fg: '#ffffff', border: 'transparent', radius: true },
  link: { bg: 'transparent', fg: colors.foreground, border: 'transparent', radius: false },
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  pressed: { opacity: 0.75, transform: [{ translateY: 1 }] },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.medium, letterSpacing: 0.1 },
  rounded: { borderRadius: radii.lg },
  linkLabel: { textDecorationLine: 'underline' },
})
