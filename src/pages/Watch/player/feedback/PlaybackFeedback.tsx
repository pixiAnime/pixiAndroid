/**
 * PlaybackFeedback — §14's transient chip system: the skip flash and the
 * hold-speed badge. The brightness/volume/quality gestures §14 also describes
 * are not built as over-picture gestures: volume is a slider in the settings
 * sheet instead, and brightness/quality have no control yet.
 *
 * Two pieces of chrome live here, and they have deliberately *different*
 * lifetimes, which is why they are one component rather than two:
 *
 *  - **the skip flash** — appears for a moment after a double-tap skip, then
 *    leaves. It is anchored to the edge the skip is heading toward and slides
 *    inward from it (see `FLASH_SLIDE`), so a forward skip arrives from the
 *    right and a backward one from the left — the *motion*, not just the arrow,
 *    is what makes the direction felt. Its in/out schedule is a fixed timeline
 *    (slide + fade in, hold, fade out) driven from an effect keyed on `flash`,
 *    so the component owns the whole animation and the caller never touches an
 *    `Animated.Value`. Because the caller passes a fresh `{ direction, token }`
 *    object per skip, a second skip in the same direction re-runs the effect
 *    instead of silently doing nothing — the bug a bare `SurfaceZone` invites.
 *  - **the boost badge** — held for as long as a finger is down, so it is
 *    mounted permanently at `opacity: boost ? 1 : 0` and fades on both edges.
 *    Leaving it mounted also means a hold never waits a frame for it.
 *
 * Both are `pointerEvents="none"` and `importantForAccessibility="no"`:
 * feedback is not content, and a screen reader announcing "Seek Forward 10s"
 * *after* the skip has already happened is worse than silence (§18).
 *
 * Positions: the skip chip hugs the side it is seeking toward — clear of the
 * centred play button, which used to sit on top of it — and the rate badge
 * stays top-left where the system bar cutout is not.
 */
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { FastForward, Rewind } from '@/components/icons'

import { colors, fonts, radii, spacing } from '@/theme'

import type { SurfaceZone } from '../../tapGestures'

/** Fade-in, hold, fade-out — fast in, slow out reads as an acknowledgement. */
const FLASH_IN_MS = 130
const FLASH_OUT_MS = 380
const FLASH_HOLD_MS = 280
/** How far the chip travels in from its edge on the way in, in px. */
const FLASH_SLIDE = 40
const BOOST_FADE_MS = 160

export interface FeedbackFlash {
  direction: SurfaceZone
  /** Bumps on every skip so an identical repeat re-animates. */
  token: number
}

export interface PlaybackFeedbackProps {
  /** The last skip, or `null` before any. Kept mounted after it fades. */
  flash: FeedbackFlash | null
  /** Full label for the flash, e.g. `Seek Backward 10s`. */
  flashLabel?: string
  /** Non-1× rate while held, e.g. `2×`; `null` when not holding. */
  boost: string | null
}

export function PlaybackFeedback({ flash, flashLabel, boost }: PlaybackFeedbackProps) {
  const flashOpacity = useRef(new Animated.Value(0)).current
  const flashTranslate = useRef(new Animated.Value(0)).current
  const boostOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!flash) return
    // Enter from the edge the skip is heading toward: forward slides in from
    // the right, backward from the left. The chip starts off-screen-by-a-nudge
    // and settles, so the motion itself reads as "going that way".
    const from = flash.direction === 'forward' ? FLASH_SLIDE : -FLASH_SLIDE
    flashOpacity.setValue(0)
    flashTranslate.setValue(from)
    const timeline = Animated.sequence([
      Animated.parallel([
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: FLASH_IN_MS,
          useNativeDriver: true,
        }),
        Animated.timing(flashTranslate, {
          toValue: 0,
          duration: FLASH_IN_MS,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(FLASH_HOLD_MS),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: FLASH_OUT_MS,
        useNativeDriver: true,
      }),
    ])
    timeline.start()
    // A newer skip interrupts the older timeline rather than racing it.
    return () => timeline.stop()
  }, [flash, flashOpacity, flashTranslate])

  useEffect(() => {
    Animated.timing(boostOpacity, {
      toValue: boost ? 1 : 0,
      duration: BOOST_FADE_MS,
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }, [boost, boostOpacity])

  const side = flash?.direction === 'back' ? 'left' : 'right'

  return (
    <>
      <Animated.View
        importantForAccessibility="no"
        pointerEvents="none"
        style={[
          styles.flash,
          side === 'left' ? styles.flashLeft : styles.flashRight,
          { opacity: flashOpacity, transform: [{ translateX: flashTranslate }] },
        ]}>
        <View style={styles.flashChip}>
          {flash?.direction === 'forward' ? (
            <FastForward size={26} color={colors.foreground} fill={colors.foreground} strokeWidth={1.4} />
          ) : (
            <Rewind size={26} color={colors.foreground} fill={colors.foreground} strokeWidth={1.4} />
          )}
          {flashLabel ? (
            <Text numberOfLines={2} style={styles.flashText}>
              {flashLabel}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <Animated.View
        importantForAccessibility="no"
        pointerEvents="none"
        style={[styles.boostBadge, { opacity: boostOpacity }]}>
        <Text style={styles.boostText}>{boost ?? ''}</Text>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  /**
   * The rail the chip rides: full height, pinned to one edge, so the chip is
   * vertically centred over the picture but clear of the centred play button.
   * Which edge is decided per skip (see `side` in the component).
   */
  flash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  flashLeft: { left: 0, paddingLeft: spacing.xl },
  flashRight: { right: 0, paddingRight: spacing.xl },
  /** A column: the big arrow over its label, the way YouTube draws a skip. */
  flashChip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    maxWidth: 132,
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  flashText: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.foreground,
    textAlign: 'center',
  },
  /** Press-and-hold speed — the 2× lasts only as long as the finger. */
  boostBadge: {
    position: 'absolute',
    top: 40,
    left: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.badge,
    backgroundColor: 'rgba(10,10,10,0.82)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  boostText: {
    fontFamily: fonts.mono,
    fontSize: 12.8,
    lineHeight: 18,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
})
