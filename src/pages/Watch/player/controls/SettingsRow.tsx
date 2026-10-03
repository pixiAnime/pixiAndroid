/**
 * SettingsRow — one line of a settings page, in either of its two shapes.
 *
 * A row is either a **summary** (a label, the value it currently holds, and a
 * › saying there is a list behind it) or a **value** (a label and a tick saying
 * *this is the one*). `SettingsBack` is the third shape: the header that steps
 * a level up.
 *
 * The component is deliberately dumb about what any of it *means*. The tree in
 * `../../settingsMenu` decides which page a tap lands on and what counts as
 * selected; this only draws. That split is what lets the tree be tested without
 * a renderer.
 *
 * Rows are 48 px tall rather than the popover's 34. That was a density decision
 * back when this was a 168 px corner panel with nine rows in it; inside a
 * bottom sheet the rows are full-width, and a full-width row that is shorter
 * than a comfortable touch target is just wasted screen (§18).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native'

import { colors, fonts, spacing } from '@/theme'

export interface SettingsRowProps {
  /** The visible label. */
  label: string
  /** Spoken text, when the visible label needs more context than it shows. */
  labelFor?: string
  /** The value this row currently holds — the right-hand column. */
  trailing?: string
  /** Set on a value row: it is the current one, so it gets a tick. */
  selected?: boolean
  /** Set on a summary row: tapping it goes a level deeper, so it gets a ›. */
  opens?: boolean
  onPress: () => void
}

export function SettingsRow({
  label,
  labelFor,
  trailing,
  selected,
  opens,
  onPress,
}: SettingsRowProps) {
  return (
    <Pressable
      accessibilityLabel={labelFor ?? label}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Text numberOfLines={1} style={styles.rowLabel}>
        {label}
      </Text>
      {trailing ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {trailing}
        </Text>
      ) : null}
      {selected ? (
        <Check color={colors.primary} size={16} strokeWidth={2} />
      ) : opens ? (
        <ChevronRight color={colors.mutedForeground} size={16} strokeWidth={1.6} />
      ) : null}
    </Pressable>
  )
}

/** The header row that steps one level back up the tree. */
export function SettingsBack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.backGroup}>
        <ChevronLeft color={colors.mutedForeground} size={16} strokeWidth={1.6} />
        <Text numberOfLines={1} style={styles.backLabel}>
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  /** Full-width, 48 px: the sheet's rows are the sheet's touch targets. */
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  /** The only affordance a sheet row gets — the video is still behind it. */
  rowPressed: { backgroundColor: colors.secondary },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13.6,
    lineHeight: 18,
    color: colors.foreground,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
    maxWidth: '55%',
    textAlign: 'right',
  },
  backGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /** Back headers read as chrome, not as a value: mono, uppercase, quiet. */
  backLabel: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
})
