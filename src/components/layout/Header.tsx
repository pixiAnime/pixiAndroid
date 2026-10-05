/**
 * Header — Material 3 top app bar.
 *
 * A 56px bar on the surface colour with a hairline outline: the `π` brand mark
 * + wordmark on the leading edge, and on the trailing edge the Extensions icon
 * button plus a connection-warning chip.
 *
 * The chip reflects app connectivity derived from existing state (see
 * `useConnectionStatus`) and appears only when there is something to report
 * (Connecting / Error / Stopped) — a healthy app shows nothing. It is the
 * Android analogue of the web's dropped pixiClient `ConnectionIndicator`.
 *
 * Long-pressing the mark opens the `__DEV__` spike screen (M0 harness).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Puzzle } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/ui/IconButton'
import { StatusIndicator } from '@/components/ui/Status'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useShellNav } from '@/navigation/shell'
import { colors, fonts, layout, radii, spacing } from '@/theme'

export function Header() {
  const { navigate } = useShellNav()
  const { t } = useTranslation()
  const { status } = useConnectionStatus()

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
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

        <View style={styles.right}>
          {status !== 'running' ? <StatusIndicator status={status} /> : null}
          <IconButton
            size="sm"
            variant="standard"
            accessibilityLabel={t('nav.extensions')}
            onPress={() => navigate('Extensions')}>
            <Puzzle size={20} color={colors.onSurfaceVariant} strokeWidth={1.8} />
          </IconButton>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    height: layout.headerHeight,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    /** Tablet: keep the bar's contents in the same centred column as the page. */
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontFamily: fonts.monoSemibold, fontSize: 14, color: colors.onPrimary, lineHeight: 18 },
  wordmark: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface, letterSpacing: -0.2 },
  wordmarkMuted: { color: colors.onSurfaceVariant },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
