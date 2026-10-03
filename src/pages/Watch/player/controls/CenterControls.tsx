/**
 * CenterControls — the large play button and the ±skip flanking it (§4).
 *
 * The bottom dock used to carry play and the two skip buttons alongside the
 * scrubber, the gear, mute, PiP and fullscreen. That is nine things in one
 * 52 px row, which means the one control everyone reaches for first was the
 * same size as the one nobody uses. Splitting the layout puts transport in the
 * middle of the picture — where a thumb goes without aiming — and leaves the
 * dock to what belongs on a timeline and at the edge of a screen.
 *
 * ## Why the play button is white
 *
 * `colors.primary` *is* white: the design language is monochrome chrome where
 * "primary controls are inverted, not tinted". So the one large control is a
 * solid `#fcfcfc` disc with a `#0a0a0a` glyph. It is the only opaque object
 * the player draws, which is the point — over any frame, bright or black, it
 * reads instantly, and it needs no scrim of its own.
 *
 * The ±skip buttons stay 44 px discs of nothing: they are legible against the
 * picture only because the centre button anchors the cluster, and giving them a
 * fill too would put three white blobs on the frame.
 *
 * ## Geometry
 *
 * The whole cluster sits in an `absoluteFill` with `box-none`, so the only
 * touches it takes are the three buttons themselves — the picture underneath
 * keeps its tap-to-toggle and its double-tap seek everywhere else, including
 * the empty middle of this row.
 */
import { Pressable, StyleSheet, View } from 'react-native'
import { FastForward, Pause, Play, Rewind, RotateCcw } from '@/components/icons'

import { colors, radii, spacing } from '@/theme'

import { playerWord } from '../../playerWords'

export interface CenterControlsProps {
  /** Playback hit the end: the centre button becomes a replay. */
  ended: boolean
  paused: boolean
  /** Play/pause/replay. The caller reveals the chrome first. */
  onToggle: () => void
  /** Signed skip, in seconds. The caller reveals the chrome first. */
  onSkip: (delta: number) => void
  /** The player's configured step, so the label states the real number. */
  skipSeconds: number
}

export function CenterControls({ ended, paused, onToggle, onSkip, skipSeconds }: CenterControlsProps) {
  const stepLabel = `${skipSeconds}s`

  return (
    <View pointerEvents="box-none" style={styles.row}>
      <Pressable
        accessibilityLabel={`${playerWord('seekBackward')} ${stepLabel}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => onSkip(-skipSeconds)}
        style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
        <Rewind size={24} color={colors.foreground} strokeWidth={1.5} />
      </Pressable>

      <Pressable
        accessibilityLabel={
          ended ? playerWord('replay') : paused ? playerWord('play') : playerWord('pause')
        }
        accessibilityRole="button"
        hitSlop={8}
        onPress={onToggle}
        style={({ pressed }) => [styles.play, pressed && styles.playPressed]}>
        {ended ? (
          <RotateCcw color={colors.primaryForeground} size={28} strokeWidth={2} />
        ) : paused ? (
          <Play color={colors.primaryForeground} size={28} fill={colors.primaryForeground} />
        ) : (
          <Pause color={colors.primaryForeground} size={28} fill={colors.primaryForeground} />
        )}
      </Pressable>

      <Pressable
        accessibilityLabel={`${playerWord('seekForward')} ${stepLabel}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => onSkip(skipSeconds)}
        style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
        <FastForward size={24} color={colors.foreground} strokeWidth={1.5} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  /** Fills the picture but touches only the buttons — see the file note. */
  row: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  /** 44 px — §18's comfortable minimum, and easier to hit than the dock's 28. */
  skip: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  /** The one opaque thing the player draws: inverted primary, see file note. */
  play: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  pressed: { backgroundColor: colors.overlay },
  /** Never translucent — a see-through white disc reads as a smudge. */
  playPressed: { opacity: 0.72 },
})
