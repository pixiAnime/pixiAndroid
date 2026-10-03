/**
 * PlaybackFeedback — §14's transient chip system, minus everything it says
 * is out of scope for now (volume, brightness, quality: those arrive with the
 * gesture work).
 *
 * Two pieces of chrome live here, and they have deliberately *different*
 * lifetimes, which is why they are one component rather than two:
 *
 *  - **the skip flash** — appears for a moment after a double-tap skip, then
 *    leaves. Its in/out schedule is a fixed timeline (in 90 ms, hold, out
 *    420 ms) driven from an effect keyed on `flash`, so the component owns the
 *    whole animation and the caller never touches an `Animated.Value`.
 *    Because the caller passes a fresh `{ direction, token }` object per skip,
 *    a second skip in the same direction re-runs the effect instead of
 *    silently doing nothing — which is exactly the bug a bare `SurfaceZone`
 *    union invites.
 *  - **the boost badge** — held for as long as a finger is down, so it is
 *    mounted permanently at `opacity: boost ? 1 : 0` and fades on both edges.
 *    Leaving it mounted also means a hold never waits a frame for it.
 *
 * Both are `pointerEvents="none"` and `importantForAccessibility="no"`:
 * feedback is not content, and a screen reader announcing "Seek Forward 10s"
 * *after* the skip has already happened is worse than silence (§18).
 *
 * Positions are the brief's: skip feedback near the centre where the eye
 * already is, the rate badge top-left where the system bar cutout is not.
 */
import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { FastForward, Rewind } from 'lucide-react-native'

import { colors, fonts, radii, spacing } from '@/theme'

import type { SurfaceZone } from '../../tapGestures'

/** Fade-in, hold, fade-out — fast in, slow out reads as an acknowledgement. */
const FLASH_IN_MS = 90
const FLASH_OUT_MS = 420
const FLASH_HOLD_MS = 260
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
  const boostOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!flash) return
    flashOpacity.setValue(0)
    const timeline = Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: FLASH_IN_MS,
        useNativeDriver: true,
      }),
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
  }, [flash, flashOpacity])

  useEffect(() => {
    Animated.timing(boostOpacity, {
      toValue: boost ? 1 : 0,
      duration: BOOST_FADE_MS,
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }, [boost, boostOpacity])

  return (
    <>
      <Animated.View
        importantForAccessibility="no"
        pointerEvents="none"
        style={[styles.flash, { opacity: flashOpacity }]}>
        <View style={styles.flashChip}>
          {flash?.direction === 'forward' ? (
            <FastForward size={20} color={colors.foreground} strokeWidth={1.6} />
          ) : (
            <Rewind size={20} color={colors.foreground} strokeWidth={1.6} />
          )}
          {flashLabel ? <Text style={styles.flashText}>{flashLabel}</Text> : null}
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
  /** Centred, where a double-tap already put the viewer's attention (§14). */
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  flashText: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.foreground,
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
