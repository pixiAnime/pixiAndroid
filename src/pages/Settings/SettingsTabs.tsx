/**
 * The category switcher at the top of Settings.
 *
 * A horizontal strip of chips rather than a full-width segment: five labels do
 * not fit one row on a narrow phone, and a wrapping second line would push the
 * panels down the page every time the label count changed. The strip scrolls
 * sideways instead, and the active chip stays put because it is the one the
 * user is looking at.
 */
import { ScrollView, StyleSheet, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { colors, fonts, radii, spacing } from '@/theme'
import { mobileKeys } from '@/i18n/mobile'

import { SETTINGS_TABS, type SettingsTab } from './tabs'

export function SettingsTabs({
  active,
  onChange,
}: {
  active: SettingsTab
  onChange: (tab: SettingsTab) => void
}) {
  const { t } = useTranslation()

  return (
    <View accessibilityRole="tablist" accessibilityLabel={t(mobileKeys.tabsAria)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Negative margin so the chips line up with the page gutter and the
        // scroll padding keeps the last chip off the screen edge.
        contentContainerStyle={styles.strip}
        style={styles.scroller}>
        {SETTINGS_TABS.map((tab) => {
          const selected = tab.key === active
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(tab.labelKey)}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && !selected && styles.pressed,
              ]}>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroller: {
    // Bleed the strip to the page gutters so a chip can sit flush with the
    // heading above it while still scrolling to the screen edge.
    marginHorizontal: -spacing.xs,
  },
  strip: { gap: spacing.s1_5, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainer,
  },
  chipSelected: { borderColor: colors.secondaryContainer, backgroundColor: colors.secondaryContainer },
  chipLabel: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },
  chipLabelSelected: { color: colors.onSecondaryContainer },

  pressed: { opacity: 0.7 },
})