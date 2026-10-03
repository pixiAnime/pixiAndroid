/**
 * Settings — hub for the sections that left the nav (History, My List,
 * Extensions), the language picker, and an about panel.
 *
 * Direct port of `pixiWeb/src/pages/Settings/Settings.tsx`, minus the two
 * bridge-only affordances Android does not have:
 *
 *  - `<ConnectionIndicator />` in the About header (already dropped in the
 *    RN shell) — there is no pixiClient bridge to probe;
 *  - the `Playback` about row, whose whole value is
 *    "via pixiClient bridge · {{url}}".
 *
 * Everything else is byte-for-byte the same i18n keys, in the same order.
 * `<Link to>` becomes `navigation.navigate`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronRight, History, List, Puzzle } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { ScreenLayout } from '@/components/layout'
import { Separator } from '@/components/ui/Primitives'
import { Button } from '@/components/ui/Button'
import { StatusBanner } from '@/components/ui/Status'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { LANGUAGES, setLanguage } from '@/i18n'
import type { RootStackParamList } from '@/navigation/types'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

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

/** Terms/values are i18n keys. The web's `Playback` row is bridge-only → omitted. */
const ABOUT: Array<{ termKey: string; valueKey: string }> = [
  { termKey: 'settings.aboutData', valueKey: 'settings.aboutDataValue' },
  { termKey: 'settings.aboutStorage', valueKey: 'settings.aboutStorageValue' },
  { termKey: 'settings.aboutPrivacy', valueKey: 'settings.aboutPrivacyValue' },
]

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { status } = useConnectionStatus()
  const navigation = useNavigation<Nav>()
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]

  return (
    <ScreenLayout contentStyle={styles.page}>
      {/* `space-y-6` stack from the web page */}
      <View style={styles.stack}>
        <View style={styles.headerTitles}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('nav.settings')}
          </Text>
          <Text style={styles.subtitle}>{t('settings.pageDesc')}</Text>
        </View>

        {/* Connection status — the app has no bridge, so this is the honest
            connectivity surface. Shown only when there is something to report
            (Connecting / Error / Stopped); a healthy app stays quiet. */}
        {status !== 'running' ? <StatusBanner status={status} /> : null}

        {/* Sections — `grid gap-3` on the web, a single column at phone width */}
        <View accessibilityLabel={t('settings.sectionsAria')} style={styles.sections}>
          {SECTIONS.map((section) => (
            <Pressable
              key={section.route}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.sectionCard,
                pressed && styles.sectionCardPressed,
              ]}
              onPress={() => navigation.navigate(section.route)}>
              <View style={styles.sectionIcon}>
                <section.icon size={20} color={colors.mutedForeground} strokeWidth={1.6} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionLabel}>{t(section.labelKey)}</Text>
                <Text style={styles.sectionDesc}>{t(section.descKey)}</Text>
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.6} />
            </Pressable>
          ))}
        </View>

        {/* Language picker — persisted, drives the active i18n language */}
        <View accessibilityLabel={t('settings.languageAria')} style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelHeadLabel}>{t('settings.languageHeading')}</Text>
          </View>
          <View style={styles.panelBody}>
            <View style={styles.languageRow}>
              {LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  size="xs"
                  variant={current === lang.code ? 'secondary' : 'outline'}
                  accessibilityState={{ selected: current === lang.code }}
                  onPress={() => setLanguage(lang.code)}>
                  {lang.label}
                </Button>
              ))}
            </View>
            <Text style={styles.panelNote}>{t('settings.languageDesc')}</Text>
          </View>
        </View>

        {/* About */}
        <View accessibilityLabel={t('settings.aboutAria')} style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelHeadLabel}>{t('settings.aboutHeading')}</Text>
          </View>
          <View>
            {ABOUT.map((row, index) => (
              <View key={row.termKey}>
                {index > 0 ? <Separator /> : null}
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutTerm}>{t(row.termKey)}</Text>
                  <Text style={styles.aboutValue}>{t(row.valueKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  page: { gap: 40 },
  /** Web page root is `space-y-6`. */
  stack: { gap: spacing.xl },

  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  sections: { gap: spacing.lg },
  /** `border border-border bg-card p-4 outline-none hover:border-foreground/40` */
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
  },
  sectionCardPressed: { opacity: 0.9 },
  /** `size-10 border border-border bg-muted` */
  sectionIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.onSurface,
  },
  sectionDesc: { ...text.meta },

  panel: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  /** `border-b px-4 py-3` */
  panelHead: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  /** `font-mono text-[0.7rem] tracking-wide uppercase text-muted-foreground` */
  panelHeadLabel: { ...text.monoLabel },
  /** `px-4 py-3 space-y-2` */
  panelBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  panelNote: { ...text.meta },

  /** `divide-y divide-border` rows — phone layout is `flex-col gap-0.5`. */
  aboutRow: {
    flexDirection: 'column',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  /** `font-mono text-[0.65rem] tracking-wide uppercase` */
  aboutTerm: { ...text.monoSmall },
  aboutValue: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.foreground },
})
