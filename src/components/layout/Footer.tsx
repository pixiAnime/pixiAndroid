/**
 * Footer — a top-ruled surface block with the wordmark, the attribution line
 * and the secondary nav links.
 *
 * The web's `footer.bridgeLabel {config.pixiClient.baseUrl}` line stays dropped
 * because Android has no bridge to address.
 */
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { SECONDARY_NAV } from '@/navigation/navItems'
import { useShellNav } from '@/navigation/shell'
import { colors, fonts, layout, spacing } from '@/theme'

export function Footer() {
  const { navigate } = useShellNav()
  const { t } = useTranslation()

  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        <View style={styles.brandBlock}>
          <Text style={styles.wordmark}>pixiAndroid</Text>
          <Text style={styles.meta}>
            {t('footer.metaBy')}{' '}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('https://jikan.moe').catch(() => undefined)}>
              {t('footer.jikan')}
            </Text>
            {t('footer.bridgeBy')}
          </Text>
        </View>

        <View style={styles.links}>
          {SECONDARY_NAV.map((item) => (
            <Pressable
              key={item.to}
              accessibilityRole="link"
              onPress={() => navigate(item.screen)}
              hitSlop={6}>
              <Text style={styles.linkLabel}>{t(item.labelKey)}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="link" onPress={() => navigate('Settings')} hitSlop={6}>
            <Text style={styles.linkLabel}>{t('nav.settings')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing.huge, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  inner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    /** Tablet: same centred column as the page body. */
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  brandBlock: { gap: spacing.xs },
  wordmark: {
    fontFamily: fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.onSurface,
  },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.onSurfaceVariant },
  link: { textDecorationLine: 'underline', color: colors.onSurfaceVariant },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
  linkLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.onSurfaceVariant,
  },
})
