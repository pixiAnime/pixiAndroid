/**
 * NotFound — the catch-all route, ported from `pixiWeb/src/pages/NotFound`.
 * The giant `text-6xl font-bold text-foreground/20` numeral is the whole
 * design: a `404` ghosted into the background, then the copy and two exits.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'

import { ScreenLayout } from '@/components/layout'
import { Button } from '@/components/ui/Button'
import type { RootStackParamList } from '@/navigation/types'
import { colors, spacing, text } from '@/theme'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()

  return (
    <ScreenLayout>
      <View style={styles.body}>
        <Text style={styles.numeral}>404</Text>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('notFound.title')}
          </Text>
          <Text style={styles.description}>{t('notFound.description')}</Text>
        </View>
        <View style={styles.actions}>
          <Button onPress={() => navigation.navigate('Home')}>{t('common.backHome')}</Button>
          <Button variant="outline" onPress={() => navigation.navigate('Search')}>
            {t('notFound.searchCta')}
          </Button>
        </View>
      </View>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', justifyContent: 'center', gap: spacing.xl, paddingVertical: 96, textAlign: 'center' },
  numeral: { ...text.errorNumeral, fontSize: 48, lineHeight: 56, color: colors.foreground, opacity: 0.2 },
  copy: { gap: 6 },
  title: { ...text.pageHeading, color: colors.foreground, textAlign: 'center' },
  description: { fontFamily: undefined, fontSize: 14, lineHeight: 20, color: colors.mutedForeground, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
})
