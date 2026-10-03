/**
 * `Input` — Material 3 outlined text field.
 *
 * A 56px field with a 12px radius, a hairline `outline` border that brightens
 * to `primary` on focus and switches to `error` when invalid, a small label
 * above in the label style, and optional supporting/error copy below.
 *
 * `mono` renders the value in Geist Mono — used for URLs and extension ids.
 */
import { forwardRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export interface InputProps extends TextInputProps {
  /** Label rendered above the field. */
  label?: string
  /** Renders a fixed-width monospace value (URLs, ids). */
  mono?: boolean
  /** Error copy shown below the field, in the error colour. */
  error?: string
}

export const Input = forwardRef<TextInputInstance, InputProps>(function InputImpl(
  { label, mono, error, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.onSurfaceVariant}
        {...rest}
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          onBlur?.(event)
        }}
        style={[
          styles.input,
          mono && styles.mono,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    color: colors.onSurfaceVariant,
  },
  input: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: spacing.lg - 1 },
  inputError: { borderColor: colors.error },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  error: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.error },
})
