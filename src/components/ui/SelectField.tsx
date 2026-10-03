/**
 * `SelectField` — the port of the shadcn `Select` used across the Browse
 * filters and Settings rows.
 *
 * The web version is an inline Radix dropdown; on a phone the equivalent
 * gesture is a tap-to-open list. We use a bottom-anchored modal rather than
 * a native picker because the options need the same mono uppercase labels,
 * the same hairline borders, and an explicit "All" option — none of which a
 * platform picker can render in our type system.
 */
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { colors, fonts, radii, spacing, text } from '@/theme'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** `disabled` on the web control — typically `isFiltering` in Browse. */
  disabled?: boolean
}

export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, disabled && styles.triggerDisabled]}>
        <Text numberOfLines={1} style={styles.triggerLabel}>
          {selected?.label ?? value}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Dismiss" />
        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.sheetList} bounces={false}>
              {options.map((option) => {
                const active = option.value === value
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    style={[styles.option, active && styles.optionActive]}>
                    <Text numberOfLines={1} style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {option.label}
                    </Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  trigger: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: 'rgba(255,255,255,0.045)',
    gap: spacing.sm,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerLabel: { flex: 1, color: colors.foreground, fontFamily: fonts.regular, fontSize: 14 },
  caret: { color: colors.mutedForeground, fontSize: 11 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sheet: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  sheetCard: {
    backgroundColor: colors.popover,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    maxHeight: '70%',
  },
  sheetTitle: { ...text.monoSmall, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sheetList: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  optionActive: { backgroundColor: colors.accent },
  optionLabel: { flex: 1, color: colors.foreground, fontFamily: fonts.regular, fontSize: 14 },
  optionLabelActive: { fontFamily: fonts.medium },
  check: { color: colors.foreground, fontSize: 13 },
})
