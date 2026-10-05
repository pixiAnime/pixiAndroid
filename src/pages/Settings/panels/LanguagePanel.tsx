/**
 * App language. The only setting that changes what the rest of the page says,
 * so it sits directly under the header rather than behind a panel header.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { LANGUAGES, setLanguage } from '@/i18n'
import { spacing, text } from '@/theme'

import { Panel } from '../components'

export function LanguagePanel() {
  const { t, i18n } = useTranslation()
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]

  return (
    <Panel label={t('settings.languageHeading')} ariaLabel={t('settings.languageAria')}>
      <View style={styles.body}>
        <View style={styles.row}>
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
        <Text style={styles.note}>{t('settings.languageDesc')}</Text>
      </View>
    </Panel>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  note: { ...text.meta },
})