/**
 * `SelectField` — Material 3 select surface.
 *
 * A tappable outlined field that opens a bottom-anchored sheet (top corners
 * only) of single-choice rows. A native picker can't render our type system or
 * an explicit "Any" option, which is why the web's Radix dropdown becomes a
 * sheet here.
 */
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  /** Disabled on the control — typically `isFiltering` in Browse. */
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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Dismiss" />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheetCard}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView style={styles.sheetList} bounces={false} showsVerticalScrollIndicator={false}>
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
                    {active ? <Check size={18} color={colors.primary} strokeWidth={2.2} /> : null}
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
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.onSurfaceVariant,
  },
  trigger: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainerLow,
    gap: spacing.sm,
  },
  triggerDisabled: { opacity: 0.38 },
  triggerLabel: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: 15 },
  caret: { color: colors.onSurfaceVariant, fontSize: 12 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: colors.surfaceContainerHigh,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '72%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.outline,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onSurface,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sheetList: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    minHeight: 52,
    gap: spacing.sm,
    borderRadius: radii.md,
    marginHorizontal: spacing.sm,
  },
  optionActive: { backgroundColor: colors.secondaryContainer },
  optionLabel: { flex: 1, color: colors.onSurface, fontFamily: fonts.regular, fontSize: 15 },
  optionLabelActive: { fontFamily: fonts.medium },
})
