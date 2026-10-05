/**
 * BottomNav — Material 3 navigation bar.
 *
 * Four equal destinations on an 80dp bar: 12dp top inset, a 32dp icon slot, a
 * 4dp gap, a 16dp label line and 16dp below it (12 + 32 + 4 + 16 + 16 = 80) —
 * M3's nav-bar rhythm, a 24dp icon over a 12sp/16sp label.
 *
 * Three things make it read as an Android bar rather than a web tab strip:
 *
 *  - **Outlined → filled.** A resting destination draws lucide's outline; the
 *    active one draws its filled twin. M3 says it outright: "inactive
 *    destinations are indicated by an outlined version of the icon… active
 *    destinations are indicated by a filled icon enclosed in a pill". So the
 *    stroke no longer thickens with selection — see `@/navigation/navIcons`
 *    for why those twins are hand-assembled rather than a `fill` prop.
 *  - **No rule along the top.** M3's bar has no shadow and no divider: the
 *    tonal step from the content (`#101214`) up to `surfaceContainer` is the
 *    separation. The hairline was the web-tab-strip tell.
 *  - **Colour-only label emphasis.** Both labels keep `navLabel`'s medium
 *    weight; the active one only moves to `onSurface`. A semibold white label
 *    was the second tell — Android lets the pill and the filled icon carry
 *    the state.
 *
 * The active destination gets M3's active indicator: a 64×32dp pill (radius
 * 16 — half its height, so it is a true pill on every renderer) filled with
 * `primaryContainer`, a tonal step *above* the bar instead of a loud inverted
 * white pill, with the icon on `onPrimaryContainer`. The capsule fades and
 * scales in over 200ms on the emphasized curve, so switching tabs cross-fades
 * rather than popping.
 *
 * **No press feedback at all** — deliberate, and the second revision. First a
 * bounded ripple (its bounds are the raw view rect, so every tap flashed a
 * hard-edged grey square over the rounded tile), then M3's own answer, a 12%
 * onSurface *state layer* painted as the tile's background: rounded this time,
 * but still a whitish wash on touch. Both read as an artifact rather than as
 * feedback, so there is now nothing — no `android_ripple`, no hover path, no
 * colour change while held. The capsule cross-fade carries the whole state
 * change; a press on the already-active tab intentionally does nothing.
 *
 * Active state follows the focused route, so a detail screen — which is not
 * one of the four items — highlights nothing. Every item stays tappable, active
 * or not; tapping the active one simply re-focuses it (StackRouter no-ops), so
 * there is nothing to draw for the press either way.
 */
import { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { NAV_ITEMS, type NavItem } from '@/navigation/navItems'
import { useShellNav } from '@/navigation/shell'
import { colors, layout, radii, spacing, text } from '@/theme'

/** Capsule cross-fade: `motionDurationShort2` (200ms) on emphasized easing. */
const INDICATOR_DURATION = 200

/** M3: icon 24dp inside a 64×32dp active indicator. */
const ICON_SIZE = 24
const ICON_STROKE = 1.8
const INDICATOR_WIDTH = 64
const INDICATOR_HEIGHT = 32

function TabItem({
  item,
  label,
  active,
  onPress
}: {
  item: NavItem
  label: string
  active: boolean
  onPress: () => void
}) {
  /* Outlined while resting, filled while active — the state change is a
     different glyph, not a heavier stroke. */
  const Icon = active ? item.activeIcon : item.icon
  /* Starts at its resting value so first paint never animates the capsule in. */
  const indicator = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(indicator, {
      toValue: active ? 1 : 0,
      duration: INDICATOR_DURATION,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true
    }).start()
  }, [active, indicator])

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}>
      <View style={styles.iconSlot}>
        {/* The capsule sits *behind* the icon, so it can fade independently. */}
        <Animated.View
          style={[
            styles.indicator,
            {
              opacity: indicator,
              transform: [
                { scale: indicator.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }
              ]
            }
          ]}
        />
        <Icon
          size={ICON_SIZE}
          color={active ? colors.onPrimaryContainer : colors.onSurfaceVariant}
          strokeWidth={ICON_STROKE}
        />
      </View>
      <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function BottomNav() {
  const { activeRoute, navigate } = useShellNav()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {NAV_ITEMS.map((item) => (
          <TabItem
            key={item.screen}
            item={item}
            label={t(item.labelKey)}
            active={activeRoute === item.screen}
            onPress={() => navigate(item.screen)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  /* No top rule: the tonal step to `surfaceContainer` is the whole edge, the
     way a Material navigation bar separates itself. */
  nav: { backgroundColor: colors.surfaceContainer },
  /* Tablet: the bar's background stays edge to edge; the destinations centre. */
  row: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  item: {
    flex: 1,
    minHeight: layout.bottomNavHeight,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderRadius: radii.xl,
    overflow: 'hidden'
  },
  iconSlot: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center'
  },
  indicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryContainer
  },
  /* Weight stays put on both states; only the colour moves. */
  label: { ...text.navLabel, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  labelActive: { color: colors.onSurface }
})
