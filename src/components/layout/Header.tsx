/**
 * Header — brand, quick search, Extensions entry.
 *
 * The web header is sticky, `h-13` (52px), `border-b` on an 85%-opaque
 * background, and carries: the `π` mark + wordmark, a desktop nav (hidden
 * below `lg`), a search pill (hidden below `md`), a dedicated Extensions
 * pill, and the pixiClient `ConnectionIndicator`.
 *
 * On a phone the desktop nav and the search pill are already hidden, so the
 * mobile header is brand + Extensions. The `ConnectionIndicator` is dropped
 * deliberately: it reports bridge health, and there is no bridge on Android —
 * HTTP and the QuickJS sandbox are native, so the signal has no referent.
 *
 * Long-pressing the mark opens the `__DEV__` spike screen (M0 harness).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Puzzle } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { useShellNav } from '@/navigation/shell'
import { colors, fonts, layout, spacing } from '@/theme'

export function Header() {
  const { navigate } = useShellNav()
  const { t } = useTranslation()

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.left}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="pixiAndroid home"
            onPress={() => navigate('Home')}
            onLongPress={() => navigate('Dev')}
            style={styles.brand}>
            <View style={styles.mark}>
              <Text style={styles.markGlyph}>π</Text>
            </View>
            <Text style={styles.wordmark}>
              pixi
              <Text style={styles.wordmarkMuted}>Android</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.right}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.extensions')}
            onPress={() => navigate('Extensions')}
            style={styles.pill}>
            <Puzzle size={12} color={colors.mutedForeground} strokeWidth={1.6} />
            <Text style={styles.pillLabel}>{t('nav.extensions')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, minWidth: 0, flexShrink: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: 'rgba(252,252,252,0.5)',
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontFamily: fonts.monoSemibold, fontSize: 13, color: colors.background, lineHeight: 16 },
  wordmark: { fontFamily: fonts.semibold, fontSize: 14, color: colors.foreground, letterSpacing: -0.2 },
  wordmarkMuted: { color: colors.mutedForeground },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pill: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
})
