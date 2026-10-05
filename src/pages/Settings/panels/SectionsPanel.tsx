/**
 * The screens that left the bottom navigation (History, My List, Extensions)
 * as the first panel of Settings — big tappable cards, because they are
 * navigation rather than configuration.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { ChevronRight, History, List, Puzzle } from '@/components/icons'
import { colors, fonts, radii, spacing } from '@/theme'

import type { SettingsNav } from '../types'

interface Section {
  route: 'History' | 'MyList' | 'Extensions'
  labelKey: string
  descKey: string
  icon: typeof History
}

const SECTIONS: Section[] = [
  {
    route: 'History',
    labelKey: 'nav.history',
    descKey: 'settings.sectionHistoryDesc',
    icon: History,
  },
  {
    route: 'MyList',
    labelKey: 'nav.myList',
    descKey: 'settings.sectionMyListDesc',
    icon: List,
  },
  {
    route: 'Extensions',
    labelKey: 'nav.extensions',
    descKey: 'settings.sectionExtensionsDesc',
    icon: Puzzle,
  },
]

export function SectionsPanel() {
  const { t } = useTranslation()
  const navigation = useNavigation<SettingsNav>()

  return (
    <View accessibilityLabel={t('settings.sectionsAria')} style={styles.sections}>
      {SECTIONS.map((section) => (
        <Pressable
          key={section.route}
          accessibilityRole="link"
          accessibilityLabel={t(section.labelKey)}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => navigation.navigate(section.route)}>
          <View style={styles.icon}>
            <section.icon size={20} color={colors.mutedForeground} strokeWidth={1.6} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.label}>{t(section.labelKey)}</Text>
            <Text style={styles.desc}>{t(section.descKey)}</Text>
          </View>
          <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.6} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  sections: { gap: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
  },
  cardPressed: { opacity: 0.9 },
  icon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.onSurface,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
})