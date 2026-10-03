/**
 * BottomNav — primary navigation on a phone (the web's header nav is
 * `lg`-only, so below `lg` this is the whole navigation surface).
 *
 * Web geometry, preserved exactly: a fixed strip with `border-t`, four equal
 * columns, each `min-h-14` (56px) tall, a **2px top border that is the active
 * indicator** (transparent when inactive), a 16px icon over a mono uppercase
 * label, and `pb-[env(safe-area-inset-bottom)]`.
 *
 * Active state follows the focused route, matching `<NavLink>` on the
 * pathname: a detail screen is not one of the four items, so nothing is
 * highlighted while you're on `/anime/123`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { NAV_ITEMS } from '@/navigation/navItems'
import { useShellNav } from '@/navigation/shell'
import { colors, layout, spacing, text } from '@/theme'

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
              style={[styles.item, active && styles.itemActive]}>
              <Icon size={16} color={active ? colors.foreground : colors.mutedForeground} strokeWidth={1.6} />
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
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  row: { flexDirection: 'row' },
  item: {
    flex: 1,
    minHeight: layout.bottomNavHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.s1_5,
    paddingHorizontal: 2,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  itemActive: { borderTopColor: colors.foreground },
  label: { ...text.navLabel, color: colors.mutedForeground },
  labelActive: { color: colors.foreground },
})
