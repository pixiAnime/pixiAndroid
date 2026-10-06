/**
 * The in-player skip button.
 *
 * Sits above the dock, where a thumb already rests to reach the play controls,
 * and appears only while the playhead is inside an interval Aniskip knows
 * about. It is deliberately a floating pill rather than a dock control: the
 * dock's contents are fixed height, and a button that appears and disappears
 * there would shift everything next to it four times a second.
 *
 * It subscribes to the playhead itself, exactly like the scrubber and the cue
 * overlay: `onProgress` fires four times a second and must not re-render the
 * player to move a pill.
 */
import { StyleSheet, Text, Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { SkipForward } from '@/components/icons'
import { mobileKeys } from '@/i18n/mobile'
import type { SkipInterval } from '@/api/aniskip'
import { colors, fonts, radii, spacing } from '@/theme'

import { usePlayhead } from './playhead'
import { activeSkipInterval } from './skipTimes'

/** Clearance for the dock below; the pill would otherwise sit on its controls. */
const DOCK_CLEARANCE = 88

export function SkipPrompt({
  intervals,
  onSkip,
}: {
  intervals: readonly SkipInterval[] | undefined
  onSkip: (interval: SkipInterval) => void
}) {
  // Whole seconds: the button appears and disappears on second boundaries,
  // which is also the resolution of every timestamp the service reports.
  const second = usePlayhead((state) => Math.floor(state.position))
  const interval = activeSkipInterval(intervals, second)
  if (!interval) return null

  return <SkipButton interval={interval} onPress={() => onSkip(interval)} />
}

function SkipButton({
  interval,
  onPress,
}: {
  interval: SkipInterval
  onPress: () => void
}) {
  const { t } = useTranslation()
  const label =
    interval.kind === 'op' ? t(mobileKeys.skipIntroAction) : t(mobileKeys.skipOutroAction)

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        <SkipForward color={colors.onSecondaryContainer} size={16} strokeWidth={1.8} />
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: DOCK_CLEARANCE,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.secondaryContainer,
  },
  pressed: { opacity: 0.82 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSecondaryContainer,
  },
})