/**
 * BottomBar — the timeline, and the four controls that belong at a screen edge.
 *
 * When the dock was one row carrying play, both skips, the scrubber, the gear,
 * mute, PiP and fullscreen it was nine controls wide: on a 411 px screen that
 * left the rail about a thumb's width to live in, and made the play button —
 * the one thing everyone taps — the same size as the picture-in-picture icon
 * nobody has ever tapped on purpose. Transport has moved to `CenterControls`,
 * which is where a thumb goes without aiming; what is left here is what a
 * timeline actually needs.
 *
 *  - **left**: the rail, edge to edge, with both clocks. Nothing else. A
 *    scrub target wants the whole width to itself, because the first and last
 *    second of a film are exactly the seconds people miss.
 *  - **right**: settings, mute, PiP, fullscreen. These are *edge* controls —
 *    you reach for them by going to a corner, not by aiming — so they sit
 *    together at the end of the row rather than being spaced along it.
 *
 * The non-1× rate chip keeps its seat next to the gear: it is a readout of a
 * state the gear owns, and it only exists while the state is unusual.
 *
 * ## Why it is a Fragment
 *
 * Same reason as `TopBar`: `<Scrim>` has to be a sibling of the row *inside*
 * the player's dock, because the dock's 44 px gradient padding is part of the
 * box the scrim's `absoluteFill` measures. Wrapping these two in a View would
 * shrink that box to the row and turn the gradient back into a panel.
 */
import { Fragment } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Maximize, Minimize, PictureInPicture2, Settings, Volume2, VolumeX } from '@/components/icons'

import { colors, fonts, radii, spacing } from '@/theme'

import { playerWord } from '../../playerWords'
import { Scrim } from '../Scrim'
import { formatRate } from '../format'
import { ProgressBar } from './ProgressBar'

export interface BottomBarProps {
  /** Any touch restarts the auto-hide countdown. */
  onInteract: () => void
  /** A scrub began/ended: the player suspends the auto-hide while true. */
  onScrubChange: (scrubbing: boolean) => void
  /** Commit a seek, in seconds. Fired when the finger lifts. */
  onSeek: (seconds: number) => void
  /** TalkBack increment/decrement — the player owns the step size. */
  onSeekStep: (direction: 1 | -1) => void
  /** Seconds per TalkBack step, used to label the accessibility actions. */
  stepSeconds: number
  settingsOpen: boolean
  onSettings: () => void
  /** Non-1× playback rate; the chip renders only while it differs from 1. */
  rate: number
  muted: boolean
  onToggleMuted: () => void
  /** Follows the system's own PiP events, so it can be true without a tap. */
  pipActive: boolean
  onTogglePip: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}

export function BottomBar({
  onInteract,
  onScrubChange,
  onSeek,
  onSeekStep,
  stepSeconds,
  settingsOpen,
  onSettings,
  rate,
  muted,
  onToggleMuted,
  pipActive,
  onTogglePip,
  fullscreen,
  onToggleFullscreen,
}: BottomBarProps) {
  return (
    <Fragment>
      <Scrim edge="bottom" />

      <View pointerEvents="box-none" style={styles.row}>
        {/*
          The clocks and the scrubber. It subscribes to the playhead itself:
          this is the one widget that would otherwise re-render four times a
          second, and §19 says it should be the only one.
        */}
        <ProgressBar
          onInteract={onInteract}
          onScrubChange={onScrubChange}
          onSeek={onSeek}
          onSeekStep={onSeekStep}
          stepSeconds={stepSeconds}
        />

        <Pressable
          accessibilityLabel={playerWord('settings')}
          accessibilityRole="button"
          accessibilityState={{ expanded: settingsOpen }}
          hitSlop={6}
          onPress={onSettings}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Settings size={16} color={colors.foreground} strokeWidth={1.6} />
        </Pressable>

        {/* Only shown when it differs from 1×, so the bar stays quiet by
            default. `none` so a tap on it falls through like everything
            else that is not a button. */}
        {rate !== 1 ? (
          <Text pointerEvents="none" style={styles.rate}>
            {formatRate(rate)}
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={muted ? playerWord('unmute') : playerWord('mute')}
          accessibilityRole="button"
          accessibilityState={{ selected: muted }}
          hitSlop={6}
          onPress={onToggleMuted}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          {muted ? (
            <VolumeX size={16} color={colors.foreground} strokeWidth={1.6} />
          ) : (
            <Volume2 size={16} color={colors.foreground} strokeWidth={1.6} />
          )}
        </Pressable>

        {/* Picture-in-picture — a window Android owns, so the icon follows
            its own events rather than only our taps. */}
        <Pressable
          accessibilityLabel={playerWord('pictureInPicture')}
          accessibilityRole="button"
          accessibilityState={{ selected: pipActive }}
          hitSlop={6}
          onPress={onTogglePip}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <PictureInPicture2
            color={pipActive ? colors.primary : colors.foreground}
            size={16}
            strokeWidth={1.6}
          />
        </Pressable>

        <Pressable
          accessibilityLabel={
            fullscreen ? playerWord('exitFullscreen') : playerWord('enterFullscreen')
          }
          accessibilityRole="button"
          hitSlop={6}
          onPress={onToggleFullscreen}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          {fullscreen ? (
            <Minimize size={16} color={colors.foreground} strokeWidth={1.6} />
          ) : (
            <Maximize size={16} color={colors.foreground} strokeWidth={1.6} />
          )}
        </Pressable>
      </View>
    </Fragment>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  button: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pressed: { backgroundColor: colors.overlay },
  /** Non-1× playback rate, shown beside the gear only while it differs. */
  rate: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
})
