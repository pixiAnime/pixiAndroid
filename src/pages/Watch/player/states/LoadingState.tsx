/**
 * LoadingState — §12 of the redesign brief.
 *
 * Two different waits, deliberately dressed differently, because they mean
 * different things to a viewer:
 *
 *  - **preparing** (no resolved target yet) — the picture is genuinely absent,
 *    so dim it slightly, centre a small indicator and say `Loading…`. The dim
 *    is a translucent layer over the frame, not a solid overlay that swallows
 *    the screen; `pointerEvents="none"` keeps the gesture layer underneath
 *    alive the whole time.
 *  - **buffering** — playback has already started, so ExoPlayer hiccuping must
 *    not flash a full loading state over the video. Nothing appears for
 *    `BUFFER_FLASH_MS`; only if the stall outlasts it does a smaller indicator
 *    fade in, and it fades back out rather than popping.
 *
 * Both are opacity-driven with `useNativeDriver`, so §16's "must disappear
 * smoothly once playback starts" costs nothing on the JS thread.
 */
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native'

import { colors, fonts, spacing } from '@/theme'

import { playerWord } from '../../playerWords'

/** A buffer this short is a hiccup, not a wait worth reporting (§12). */
const BUFFER_FLASH_MS = 600
const FADE_IN_MS = 260
const FADE_OUT_MS = 320

export interface LoadingStateProps {
  /** No playable target yet — the heavy case: dim the picture and label it. */
  preparing: boolean
  /** ExoPlayer is buffering mid-playback — a small indicator, if it lasts. */
  buffering: boolean
}

export function LoadingState({ preparing, buffering }: LoadingStateProps) {
  const dimOpacity = useRef(new Animated.Value(preparing ? 1 : 0)).current
  const bufferOpacity = useRef(new Animated.Value(0)).current

  // Mount only while something is showing: an invisible full-frame layer left
  // parked over the surface is exactly the sort of residue §19 asks us to avoid.
  const [dimMounted, setDimMounted] = useState(preparing)
  const [showBuffer, setShowBuffer] = useState(false)

  useEffect(() => {
    if (preparing) {
      setDimMounted(true)
      Animated.timing(dimOpacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start()
      return
    }
    Animated.timing(dimOpacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDimMounted(false)
    })
  }, [dimOpacity, preparing])

  useEffect(() => {
    if (!buffering) {
      setShowBuffer(false)
      return
    }
    const timer = setTimeout(() => setShowBuffer(true), BUFFER_FLASH_MS)
    return () => clearTimeout(timer)
  }, [buffering])

  useEffect(() => {
    Animated.timing(bufferOpacity, {
      toValue: showBuffer ? 1 : 0,
      duration: showBuffer ? 200 : 300,
      useNativeDriver: true,
    }).start()
  }, [bufferOpacity, showBuffer])

  return (
    <>
      {dimMounted ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.dim, { opacity: dimOpacity }]}
        >
          {/* The visible label *is* the announcement — no duplicate
              `accessibilityLabel` over it, or TalkBack says "Loading…" twice. */}
          <View style={styles.indicator}>
            <ActivityIndicator color={colors.foreground} size="small" />
            <Text style={styles.dimLabel}>{playerWord('loading')}</Text>
          </View>
        </Animated.View>
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[styles.buffer, { opacity: bufferOpacity }]}
      >
        <ActivityIndicator color={colors.foreground} size="small" />
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // A dim, not a blackout: the picture stays legible behind it (§12).
    backgroundColor: 'rgba(10, 10, 10, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  dimLabel: {
    color: colors.foreground,
    fontFamily: fonts.mono,
    fontSize: 11.2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  buffer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Pushes the centre up by half this value: at 72 the indicator clears the
    // 96 px dock entirely, so a mid-playback stall never lands on top of the
    // controls the viewer may be reaching for.
    paddingBottom: 72,
  },
})
