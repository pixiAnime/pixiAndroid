/**
 * `Switch` — Material 3 switch.
 *
 * A 52×32 track with a 24px thumb that slides on toggle; the track fills with
 * `primary` when on and stays a neutral container with an `outline` border when
 * off. Used for the extension enabled toggle (replacing the button-as-switch).
 */
import { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { colors, radii } from '@/theme'

export interface SwitchProps {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

const TRACK_WIDTH = 52
const TRACK_HEIGHT = 32
const THUMB = 24
const TRAVEL = TRACK_WIDTH - THUMB - 8 - 2 // 4px inset each side + 1px border

export function Switch({ value, onValueChange, disabled, accessibilityLabel, style }: SwitchProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 140,
      useNativeDriver: false,
    }).start()
  }, [value, progress])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] })
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceContainerHighest, colors.primary],
  })
  const thumbColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outline, colors.onPrimary],
  })

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.press, disabled && styles.disabled, style]}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: thumbColor, transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  press: { justifyContent: 'center' },
  disabled: { opacity: 0.38 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: 4,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.pill,
  },
})
