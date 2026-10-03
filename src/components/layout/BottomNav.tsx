/**
 * BottomNav — Material 3 navigation bar.
 *
 * Four equal destinations, each a 24dp icon above a 12sp label. The active
 * destination gets M3's active indicator: a 56×32 capsule (radius 16, exactly
 * half its height so it is always a true pill) behind the icon, a high-contrast
 * icon inside it, and a brighter, heavier label underneath.
 *
 * `overflow: 'hidden'` is deliberate: React Native's own docs recommend it
 * when a `borderRadius` is not visible on Android, so the indicator can never
 * fall back to a square block.
 *
 * Active state follows the focused route, so a detail screen — which is not
 * one of the four items — highlights nothing. Press feedback applies to every
 * item, active or not, because touch has no hover.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { NAV_ITEMS } from '@/navigation/navItems'
import { useShellNav } from '@/navigation/shell'
import { colors, fonts, layout, spacing, text } from '@/theme'

export function BottomNav() {
  const { activeRoute, navigate } = useShellNav()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {NAV_ITEMS.map((item) => {
          const active = activeRoute === item.screen
          const Icon = item.icon
          return (
            <Pressable
              key={item.screen}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(item.labelKey)}
              onPress={() => navigate(item.screen)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <View style={[styles.indicator, active && styles.indicatorActive]}>
                <Icon
                  size={24}
                  color={active ? colors.onPrimary : colors.onSurfaceVariant}
                  strokeWidth={active ? 2.2 : 1.8}
                />
              </View>
              <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
  },
  row: { flexDirection: 'row' },
  item: {
    flex: 1,
    minHeight: layout.bottomNavHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.half,
  },
  itemPressed: { opacity: 0.65 },
  indicator: {
    width: 56,
    height: 32,
    /* Half the height exactly — a true capsule on every renderer. */
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorActive: { backgroundColor: colors.primary },
  label: { ...text.navLabel, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  labelActive: { color: colors.onSurface, fontFamily: fonts.semibold },
})
