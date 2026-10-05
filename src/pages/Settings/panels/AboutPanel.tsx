/**
 * About — where the data lives and what the app does with it. Terms are i18n
 * keys; the web's `Playback` row is bridge-only, so it is not listed.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Separator } from '@/components/ui/Primitives'
import { colors, fonts, spacing, text } from '@/theme'

import { Panel } from '../components'

const ABOUT: Array<{ termKey: string; valueKey: string }> = [
  { termKey: 'settings.aboutData', valueKey: 'settings.aboutDataValue' },
  { termKey: 'settings.aboutStorage', valueKey: 'settings.aboutStorageValue' },
  { termKey: 'settings.aboutPrivacy', valueKey: 'settings.aboutPrivacyValue' },
]

export function AboutPanel() {
  const { t } = useTranslation()

  return (
    <Panel label={t('settings.aboutHeading')} ariaLabel={t('settings.aboutAria')}>
      {ABOUT.map((row, index) => (
        <View key={row.termKey}>
          {index > 0 ? <Separator /> : null}
          <View style={styles.row}>
            <Text style={styles.term}>{t(row.termKey)}</Text>
            <Text style={styles.value}>{t(row.valueKey)}</Text>
          </View>
        </View>
      ))}
    </Panel>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  term: { ...text.monoSmall },
  value: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.foreground,
  },
})