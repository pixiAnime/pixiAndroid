/**
 * React Navigation theme — mapped onto the M3 surface tokens so the
 * navigator's own surfaces (backdrops, card backgrounds) never introduce a
 * colour that isn't already in the system.
 */
import { DarkTheme, type Theme } from '@react-navigation/native'

import { colors } from '@/theme'

export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.surface,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.outlineVariant,
    notification: colors.error,
  },
}
