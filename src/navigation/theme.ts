/**
 * React Navigation theme — the palette is exactly pixiWeb's `:root`, so the
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
    primary: colors.foreground,
    background: colors.background,
    card: colors.background,
    text: colors.foreground,
    border: colors.border,
    notification: colors.destructive,
  },
}
