/**
 * ProgressBar — the redesigned scrubber (§6) and its scrub preview (§7).
 *
 * ## Why it is shaped like this
 *
 * This is the only part of the player that *moves* several times a second, so
 * it is also the only part allowed to know that. It reads `playhead` itself
 * rather than taking props, which buys three things the brief asks for:
 *
 *  1. **§19, no tree churn.** The component subscribes with a *narrow*
 *     selector — `Math.floor(position)` — so React re-renders it once a second,
 *     exactly when a clock digit can change. Everything faster than that (fill,
 *     buffered edge, thumb, preview card) is driven by `Animated` values from a
 *     plain `usePlayhead.subscribe` callback: no render, no Yoga pass, on the
 *     UI thread.
 *  2. **§6, smooth progress.** Ticks arrive every 250 ms. Chasing each one with
 *     a 250 ms linear `Animated.timing` turns four jumps a second into one
 *     continuous motion, and lets the whole bar travel to a new position after
 *     a seek instead of teleporting.
 *  3. **§6/§19, a drag costs nothing.** During a scrub the responder calls
 *     `frac.setValue(f)` — native, sub-frame — and the only React work is the
 *     preview timestamp, and only when the whole second it shows changes.
 *
 * ## Geometry
 *
 * The rail is a fixed 6 px pill squashed to 3 px while idle (`scaleY`, native),
 * so growing it on touch is a transform rather than a layout. The fill and the
 * buffered band are full-width children clipped by the rail and pulled left by
 * `translateX = -(1 - fraction) * railWidth` — again transforms. `width` is the
 * one animatable property here that would force Yoga to run, so nothing uses it
 * except the initial layout measurement.
 *
 * ## The preview card (§7)
 *
 * Mounted at all times but transparent, so its `onLayout` has measured it
 * *before* the first scrub — otherwise it would sit at the wrong clamp for one
 * frame. It clamps to the rail's box, which lies inside the screen, so §7's
 * "stay within screen boundaries" holds by construction. The thumbnail is a
 * deliberate slot: pass `thumbnailUri` and a frame renders above the timestamp;
 * pass nothing (as today) and the card is the timestamp alone rather than an
 * empty grey rectangle pretending to be a frame.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'

import { colors, fonts, radii, spacing } from '@/theme'

import { playerWord } from '../../playerWords'
import { clamp01, formatClock } from '../format'
import { readPlayhead, usePlayhead, type Playhead } from '../playhead'

/** Invisible touch target around the 3 px rail — §18's comfortable minimum. */
const HIT_HEIGHT = 44
/** Rail pill height at rest; squashed to 3 px while idle, full 6 px on touch. */
const RAIL_H = 6
/** Thumb diameter at rest ×2 — scaled 0.67 → 1.33, i.e. 8 px → 16 px. */
const THUMB = 12
/** First-frame guess at the preview card width; corrected by `onLayout`. */
const PREVIEW_W = 96
/** Gap between the card and the top of the touch target. */
const PREVIEW_GAP = 8
/** One progress tick, mirrored as the chase duration for continuous motion. */
const TICK_MS = 250
/** How long the rail/thumb/card take to react to a touch (§16). */
const SCRUB_MS = 160

export interface ProgressBarProps {
  /** Commit a seek, in seconds. Fired when the finger lifts. */
  onSeek: (seconds: number) => void
  /** TalkBack increment/decrement — the player owns the step size. */
  onSeekStep?: (direction: 1 | -1) => void
  /** A scrub began/ended: the player suspends its auto-hide while true. */
  onScrubChange?: (scrubbing: boolean) => void
  /** Any touch restarts the auto-hide countdown. */
  onInteract?: () => void
  /** Seconds per TalkBack step, used to label the accessibility actions. */
  stepSeconds?: number
  /** Optional frame for the preview card; absent today, see file note. */
  thumbnailUri?: string | null
}

export function ProgressBar({
  onSeek,
  onSeekStep,
  onScrubChange,
  onInteract,
  stepSeconds = 10,
  thumbnailUri = null,
}: ProgressBarProps) {
  // The only subscriptions that re-render this component: whole seconds (for
  // the clock digit) and the duration (once per source). Everything faster
  // than that is driven imperatively — see the file header.
  const clockSeconds = usePlayhead((state) => Math.floor(state.position))
  const duration = usePlayhead((state) => state.duration)

  const [railWidth, setRailWidth] = useState(0)
  const [previewWidth, setPreviewWidth] = useState(0)
  /** `null` while idle; the whole second being previewed while scrubbing. */
  const [scrubSeconds, setScrubSeconds] = useState<number | null>(null)

  const frac = useRef(new Animated.Value(0)).current
  const bufferedFrac = useRef(new Animated.Value(0)).current
  const scrubAnim = useRef(new Animated.Value(0)).current

  // Read from responder handlers that outlive a render, so they must not close
  // over the props of the render they happened to be built in.
  const durationRef = useRef(duration)
  const railWidthRef = useRef(0)
  const scrubbingRef = useRef(false)
  const railPageXRef = useRef(0)
  const chaseRef = useRef<Animated.CompositeAnimation | null>(null)
  const lastBufferedRef = useRef(-1)
  const onSeekRef = useRef(onSeek)
  const onScrubChangeRef = useRef(onScrubChange)
  const onInteractRef = useRef(onInteract)

  durationRef.current = duration
  onSeekRef.current = onSeek
  onScrubChangeRef.current = onScrubChange
  onInteractRef.current = onInteract

  const scrubbing = scrubSeconds !== null
  const displaySeconds = scrubSeconds ?? clockSeconds

  /* ---------------- store → native, never through React ---------------- */

  useEffect(() => {
    const apply = (state: Playhead) => {
      if (scrubbingRef.current) return
      const width = railWidthRef.current
      // `state.duration`, not the ref: this callback fires *inside* the store's
      // notification, before React has re-rendered with the new duration.
      const total = state.duration
      if (width <= 0 || total <= 0) {
        frac.setValue(0)
        bufferedFrac.setValue(0)
        lastBufferedRef.current = 0
        return
      }

      // Chase each tick rather than jump to it — this is §6's "smooth progress
      // animation", and `isInteraction: false` keeps the chase from being
      // counted as an input-blocking animation.
      chaseRef.current?.stop()
      const chase = Animated.timing(frac, {
        toValue: clamp01(state.position / total),
        duration: TICK_MS,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      })
      chaseRef.current = chase
      chase.start()

      // The buffered edge only ever lurches (a new segment landed), so it is
      // set outright instead of eased toward — easing would paint buffer that
      // ExoPlayer cannot serve yet.
      const buffered = clamp01(state.buffered / total)
      if (Math.abs(buffered - lastBufferedRef.current) > 0.0005) {
        lastBufferedRef.current = buffered
        bufferedFrac.setValue(buffered)
      }
    }

    apply(readPlayhead())
    return usePlayhead.subscribe(apply)
  }, [bufferedFrac, frac])

  // Re-anchor after a layout change (rotation, fullscreen) or a new source: the
  // interpolations were rebuilt for a different rail width, so put the values
  // back rather than letting them land wherever the old mapping left them.
  useEffect(() => {
    if (railWidth <= 0 || duration <= 0) return
    const state = readPlayhead()
    const buffered = clamp01(state.buffered / duration)
    lastBufferedRef.current = buffered
    bufferedFrac.setValue(buffered)
    chaseRef.current?.stop()
    frac.setValue(clamp01(state.position / duration))
  }, [bufferedFrac, duration, frac, railWidth])

  /* ---------------- touch → rail / thumb / card ---------------- */

  // `scrubbingRef` and `onScrubChange` are *not* driven from here: the
  // responder must be able to suspend the player's auto-hide in the same
  // synchronous call as the touch, without waiting a frame for an effect.
  // This effect only runs the visual half of the transition.
  useEffect(() => {
    Animated.timing(scrubAnim, {
      toValue: scrubbing ? 1 : 0,
      duration: SCRUB_MS,
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }, [scrubAnim, scrubbing])

  /* ---------------- geometry ---------------- */

  const cardOffset = previewWidth / 2
  const cardMax = Math.max(0, railWidth - previewWidth)
  // The card's left edge as a function of fraction: pinned at 0 while the thumb
  // is within half a card of the left edge, free in the middle, pinned at
  // `cardMax` at the right. `railWidth > previewWidth` is exactly the condition
  // that keeps the four input stops strictly increasing.
  const cardClamped = previewWidth > 0 && railWidth > previewWidth

  const geometry = useMemo(() => {
    /*
     * The buffered and played bands are *full-width* children of a rail that
     * clips them. They cannot animate `width` (that is a layout property, and
     * would need the JS thread), so they are shifted instead — and the shift is
     * `-(1 - frac) * railWidth`, not `-frac * railWidth`.
     *
     * The difference is the whole feature: anchored at `left: 0`, a band at
     * `translateX = 0` covers the *entire* rail, so pulling it back by `frac`
     * shows `1 - frac` — a bar that starts full and empties as you watch. The
     * sign is backwards the other way round, which is exactly the bug a device
     * check catches and a unit test never would: at 1:10 of 26:00 the rail drew
     * 95% played.
     */
    const fill = {
      width: railWidth,
      transform: [
        { translateX: frac.interpolate({ inputRange: [0, 1], outputRange: [-railWidth, 0] }) },
      ],
    }
    const buffered = {
      width: railWidth,
      transform: [
        {
          translateX: bufferedFrac.interpolate({
            inputRange: [0, 1],
            outputRange: [-railWidth, 0],
          }),
        },
      ],
    }
    const thumb = {
      transform: [
        { translateX: frac.interpolate({ inputRange: [0, 1], outputRange: [0, railWidth] }) },
        { scale: scrubAnim.interpolate({ inputRange: [0, 1], outputRange: [0.67, 1.33] }) },
      ],
    }
    const preview = {
      transform: [
        // Narrower than the card, or not measured yet: park it at the left
        // rather than build an inputRange whose stops are not strictly
        // increasing (which `interpolate` rejects outright).
        {
          translateX: cardClamped
            ? frac.interpolate({
                inputRange: [0, cardOffset / railWidth, 1 - cardOffset / railWidth, 1],
                outputRange: [0, 0, cardMax, cardMax],
              })
            : 0,
        },
        { translateY: scrubAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
      ],
      opacity: scrubAnim,
    }

    return { fill, buffered, thumb, preview }
  }, [
    bufferedFrac,
    cardClamped,
    cardMax,
    cardOffset,
    frac,
    railWidth,
    scrubAnim,
  ])

  /* ---------------- responder ---------------- */

  /**
   * Fraction of the rail under the finger. Derived from `pageX` minus the
   * rail's page origin captured on touch-down, not from `locationX`: a scrub
   * almost always ends with the finger outside the 44 px target, and
   * `locationX` stops describing the rail there.
   */
  const fractionAt = (pageX: number) => {
    const width = railWidthRef.current
    if (width <= 0) return 0
    return clamp01((pageX - railPageXRef.current) / width)
  }

  const previewAt = (fraction: number) => {
    const total = durationRef.current
    const seconds = total > 0 ? Math.floor(fraction * total) : 0
    setScrubSeconds((previous) =>
      previous === null || Math.floor(previous) !== seconds ? seconds : previous,
    )
    frac.setValue(fraction)
  }

  const handleGrant = (event: GestureResponderEvent) => {
    if (durationRef.current <= 0 || railWidthRef.current <= 0) return
    railPageXRef.current = event.nativeEvent.pageX - event.nativeEvent.locationX
    chaseRef.current?.stop()
    scrubbingRef.current = true
    onInteractRef.current?.()
    // Told in the same synchronous call as the touch: a player waiting an
    // effect's frame would happily arm its auto-hide timer under a finger.
    onScrubChangeRef.current?.(true)
    previewAt(fractionAt(event.nativeEvent.pageX))
  }

  const handleMove = (event: GestureResponderEvent) => {
    if (!scrubbingRef.current) return
    previewAt(fractionAt(event.nativeEvent.pageX))
  }

  const handleRelease = (event: GestureResponderEvent) => {
    if (!scrubbingRef.current) return
    const fraction = fractionAt(event.nativeEvent.pageX)
    const total = durationRef.current
    scrubbingRef.current = false
    setScrubSeconds(null)
    onScrubChangeRef.current?.(false)
    // Cleared *before* seeking: `seekTo` writes the store synchronously, so the
    // subscription above picks the new position up with no intervening frame in
    // which the bar would be drawn snapping back to the old position.
    if (total > 0) onSeekRef.current?.(fraction * total)
  }

  /** The touch was stolen — abandon the scrub and restore the real position. */
  const handleTerminate = () => {
    if (!scrubbingRef.current) return
    scrubbingRef.current = false
    setScrubSeconds(null)
    onScrubChangeRef.current?.(false)
    const total = durationRef.current
    if (total > 0) frac.setValue(clamp01(readPlayhead().position / total))
  }

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    const name = event.nativeEvent.actionName
    if (name !== 'increment' && name !== 'decrement') return
    onSeekStep?.(name === 'increment' ? 1 : -1)
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width
    railWidthRef.current = width
    setRailWidth(width)
  }

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    setPreviewWidth(event.nativeEvent.layout.width)
  }

  /* ---------------- render ---------------- */

  return (
    <View pointerEvents="box-none" style={styles.row}>
      {/* `none`, not the default: a digit that swallowed the tap would leave
          the viewer poking at a dead zone. Falling through means a tap here
          still toggles the controls, exactly as it does anywhere else. */}
      <Text pointerEvents="none" style={styles.clock}>
        {formatClock(displaySeconds)}
      </Text>

      <View
        accessibilityActions={[
          { name: 'increment', label: `+${stepSeconds}s` },
          { name: 'decrement', label: `−${stepSeconds}s` },
        ]}
        accessibilityLabel={playerWord('seek')}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: 0,
          max: Math.round(duration),
          now: Math.round(displaySeconds),
          text: `${formatClock(displaySeconds)} / ${formatClock(duration)}`,
        }}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleTerminate}
        style={styles.hit}>
        <Animated.View
          style={[
            styles.rail,
            {
              transform: [
                { scaleY: scrubAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
              ],
            },
          ]}>
          <Animated.View style={[styles.band, styles.buffered, geometry.buffered]} />
          <Animated.View style={[styles.band, styles.fill, geometry.fill]} />
        </Animated.View>

        {/* Outside the rail so the pill's `overflow: hidden` cannot clip it. */}
        <Animated.View pointerEvents="none" style={[styles.thumb, geometry.thumb]} />

        <Animated.View
          importantForAccessibility="no"
          onLayout={handlePreviewLayout}
          pointerEvents="none"
          style={[styles.preview, geometry.preview]}>
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={styles.previewThumb} />
          ) : null}
          <Text style={styles.previewTime}>{formatClock(displaySeconds)}</Text>
        </Animated.View>
      </View>

      <Text pointerEvents="none" style={styles.clock}>
        {formatClock(duration)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /** `flex: 1` between the two clocks, exactly where the old `trackHit` sat. */
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clock: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  hit: {
    flex: 1,
    height: HIT_HEIGHT,
    justifyContent: 'center',
  },
  rail: {
    height: RAIL_H,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.24)',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  /**
   * Buffered but not yet played — a half-step above the empty rail, never
   * bright enough to be mistaken for progress. It sits behind the fill.
   */
  buffered: { backgroundColor: 'rgba(255,255,255,0.42)' },
  /** Played — the foreground, the one thing that reads as "you are here". */
  fill: { backgroundColor: colors.primary },
  thumb: {
    position: 'absolute',
    left: -THUMB / 2,
    width: THUMB,
    height: THUMB,
    top: (HIT_HEIGHT - THUMB) / 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  preview: {
    position: 'absolute',
    bottom: HIT_HEIGHT + PREVIEW_GAP,
    left: 0,
    alignItems: 'center',
    gap: spacing.half,
    paddingHorizontal: spacing.s1_5,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(10,10,10,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  previewThumb: {
    width: PREVIEW_W - 4,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
  },
  previewTime: {
    fontFamily: fonts.monoMedium,
    fontSize: 11.2,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
})
