/**
 * `Input` — the port of `src/components/ui/input.tsx`.
 *
 * `h-8 rounded-lg border border-input bg-transparent dark:bg-input/30 px-3 py-1
 * text-sm placeholder:text-muted-foreground`, i.e. 32px tall, 2px radius,
 * 14px text, and a translucent white fill (`--input` at 30% ≈ 4.5% white).
 *
 * `font-mono` is applied when `mono` is set — used for URLs and extension
 * ids, where the web renders values in Geist Mono for the same reason the
 * meta labels are mono.
 */
import { forwardRef } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export interface InputProps extends TextInputProps {
  /** Label rendered above the field, in the micro mono style. */
  label?: string
  /** Renders a fixed-width monospace value (URLs, ids). */
  mono?: boolean
  /** Error copy shown below the field, in `--destructive`. */
  error?: string
}

export const Input = forwardRef<TextInputInstance, InputProps>(function InputImpl(
  { label, mono, error, style, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.mutedForeground}
        {...rest}
        style={[styles.input, mono && styles.mono, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  input: {
    height: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: 'rgba(255,255,255,0.045)',
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  inputError: { borderColor: colors.destructive },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.destructive },
})
