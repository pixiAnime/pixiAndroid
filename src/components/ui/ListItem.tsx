/**
 * `ListItem` — Material 3 list row.
 *
 * A leading slot (icon / avatar), a title + optional supporting line, and a
 * trailing slot (meta text, chevron, switch…). Tappable when `onPress` is set,
 * with a pressed state layer; otherwise it is a plain surface row.
 */
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radii, spacing, text } from '@/theme'

export interface ListItemProps {
  title: string
  supporting?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link' | 'none'
  style?: StyleProp<ViewStyle>
}

export function ListItem({
  title,
  supporting,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
}: ListItemProps) {
  const body = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {supporting ? (
          <Text numberOfLines={2} style={styles.supporting}>
            {supporting}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  )

  if (!onPress) {
    return <View style={[styles.row, style]}>{body}</View>
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.pressable, pressed && styles.pressed, style]}>
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
    borderRadius: radii.lg,
  },
  pressable: { backgroundColor: 'transparent' },
  pressed: { backgroundColor: colors.surfaceContainerHigh },
  leading: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...text.titleMedium, color: colors.onSurface },
  supporting: { ...text.bodySm, color: colors.onSurfaceVariant },
  trailing: { alignItems: 'center', justifyContent: 'center' },
})
