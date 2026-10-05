/**
 * Small Settings building blocks — a bordered panel with a mono header, and
 * rows that put a switch or a row of choice buttons beside (or under) a label.
 *
 * Kept separate from the page so the page reads as a list of sections rather
 * than a wall of StyleSheet. Same visual language as the existing Settings
 * panels (outlined surface, mono uppercase header).
 */
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Separator } from '@/components/ui/Primitives'
import { colors, fonts, radii, spacing, text } from '@/theme'

export function Panel({
  label,
  ariaLabel,
  children,
}: {
  /**
   * Omit for a panel that is the only one under a category header — the
   * surrounding heading already says what it is, and a second one stacked on
   * top of it is just noise.
   */
  label?: string
  ariaLabel?: string
  children: ReactNode
}) {
  return (
    <View accessibilityLabel={ariaLabel} style={styles.panel}>
      {label ? (
        <View style={styles.panelHead}>
          <Text style={styles.panelHeadLabel}>{label}</Text>
        </View>
      ) : null}
      <View>{children}</View>
    </View>
  )
}

/** A label/description with a single trailing control (a Switch, a value). */
export function SettingRow({
  title,
  description,
  children,
  first,
}: {
  title: string
  description?: string
  children?: ReactNode
  /** Omit the divider — the first row in a panel. */
  first?: boolean
}) {
  return (
    <View>
      {first ? null : <Separator />}
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
        </View>
        {children ? <View style={styles.rowControl}>{children}</View> : null}
      </View>
    </View>
  )
}

/** A label/description with a wrapped row of single-choice buttons beneath it. */
export function SettingChoice<T extends string | number>({
  title,
  description,
  value,
  options,
  onChange,
  first,
  format,
}: {
  title: string
  description?: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  first?: boolean
  format?: (value: T) => string
}) {
  return (
    <View>
      {first ? null : <Separator />}
      <View style={styles.choiceRow}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
        </View>
        <View style={styles.choiceButtons}>
          {options.map((option) => {
            const active = option === value
            return (
              <Pressable
                key={String(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onChange(option)}
                style={({ pressed }) => [
                  styles.choice,
                  active && styles.choiceActive,
                  pressed && !active && styles.pressed,
                ]}>
                <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                  {format ? format(option) : String(option)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}

/** A destructive action row — label, supporting copy and a trailing button. */
export function ActionRow({
  title,
  description,
  actionLabel,
  onPress,
  first,
  destructive,
  disabled,
}: {
  title: string
  description?: string
  actionLabel: string
  onPress: () => void
  first?: boolean
  destructive?: boolean
  disabled?: boolean
}) {
  return (
    <View>
      {first ? null : <Separator />}
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityState={{ disabled: Boolean(disabled) }}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.action,
            destructive && styles.actionDestructive,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}>
          <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  panelHead: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  panelHeadLabel: { ...text.monoLabel },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.onSurface },
  rowDesc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
  rowControl: { flexShrink: 0 },

  choiceRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  choiceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  choice: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  choiceActive: { borderColor: colors.secondaryContainer, backgroundColor: colors.secondaryContainer },
  choiceLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  choiceLabelActive: { color: colors.onSecondaryContainer },

  action: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  actionDestructive: { borderColor: colors.error },
  actionLabel: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.onSurface },
  actionLabelDestructive: { color: colors.error },

  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.38 },
})
