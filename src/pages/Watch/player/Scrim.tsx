/**
 * Scrim — a gradient behind a cluster of controls, never an opaque panel.
 *
 * `Hero.tsx` already solves "a gradient in RN" with `react-native-svg`'s
 * `LinearGradient` over an absolutely-filled `Svg`; this is the same trick with
 * the stops the player needs — transparent over the picture, near-black where
 * the buttons sit — so the frame keeps its depth instead of being cropped by a
 * flat `rgba(10,10,10,.82)` rectangle. The `Hero` stops are used verbatim as
 * the reference for tone: `colors.background`, not pure `#000` (§17).
 *
 * Opacity is driven by the caller's `Animated.Value`, so the scrim leaves with
 * the controls on one timeline rather than on its own.
 *
 * ## Why the size is measured rather than written as `100%`
 *
 * `<Svg height="100%" width="100%" />` looks like the obvious way to fill the
 * box, and it is what this did — and it is wrong the moment the box rotates.
 * The percentage is resolved by `react-native-svg` against a viewport it keeps
 * from the size it first laid out at, and the player mounts in **portrait**.
 * Entering fullscreen therefore leaves the gradient painting a 1074 px-wide
 * strip (the portrait surface's inner width) over an otherwise 2400 px-wide
 * landscape frame: the top scrim and the dock scrim both stop with a hard
 * vertical edge a little before the screen's centre, so the left of the picture
 * is darkened and the right is untouched. Measured on device — the paint ends
 * at exactly x = 1074, one pixel of transition, while the *vertical* ramp is
 * correct all along.
 *
 * So the box measures itself and hands `react-native-svg` plain pixels, which
 * nothing can resolve against a stale value, and the `<Svg>` is keyed on that
 * size so a rotation remounts it rather than asking an already-measured native
 * view to reconsider. `onLayout` costs one frame on first paint — the scrim is
 * fading in with the controls over ~200 ms anyway — and the guard below keeps a
 * repeated identical layout from looping.
 */
import { useCallback, useId, useState } from 'react'
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { colors } from '@/theme'

interface ScrimStop {
  offset: string
  opacity: number
}

/**
 * Bottom dock — measured from the *top* of the 96 px dock down to the screen
 * edge, because SVG's `y1=0` is the top and `y2=1` the bottom.
 *
 * Three anchors have to hold, and everything else is just the ramp between
 * them:
 *
 *  - `0`, transparent — the dock's top edge must not draw a line across the
 *    picture; the frame has to bleed into it.
 *  - `0.73`, ~0.82 — the vertical middle of the icons. That is the exact
 *    number the old `rgba(10,10,10,0.82)` panel was there to supply, and it is
 *    the one that cannot drop: white icons over a bright frame stop being
 *    legible well before that.
 *  - `1`, ~0.92 — the very bottom, so the rail's filled end (which is
 *    `colors.primary`) and the scrub thumb never land on raw video.
 *
 * The stop at `0.46` keeps the ramp honest: it lets a third of the dock stay
 * light enough that the picture still reads through it. A gradient that is
 * already 0.8 black at its midpoint is not a gradient, it is the rectangle this
 * replaced with a soft top.
 */
const BOTTOM_STOPS: ScrimStop[] = [
  { offset: '0', opacity: 0 },
  { offset: '0.25', opacity: 0.06 },
  { offset: '0.46', opacity: 0.3 },
  { offset: '0.73', opacity: 0.82 },
  { offset: '1', opacity: 0.92 },
]

/** Top bar: the mirror image, so a portrait picture isn't letterboxed by it. */
const TOP_STOPS: ScrimStop[] = [
  { offset: '0', opacity: 0.84 },
  { offset: '0.45', opacity: 0.36 },
  { offset: '1', opacity: 0 },
]

export interface ScrimProps {
  edge: 'top' | 'bottom'
  style?: StyleProp<ViewStyle>
}

export function Scrim({ edge, style }: ScrimProps) {
  // SVG needs a document-unique id; sanitised because React 19's `useId`
  // returns `«r0»`, which is not a legal `url(#…)` fragment.
  const id = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const stops = edge === 'bottom' ? BOTTOM_STOPS : TOP_STOPS
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setBox((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height },
    )
  }, [])

  return (
    <View
      pointerEvents="none"
      onLayout={handleLayout}
      style={[StyleSheet.absoluteFill, style]}>
      {box && box.width > 0 && box.height > 0 ? (
        <Svg
          key={`${box.width}x${box.height}`}
          height={box.height}
          width={box.width}>
          <Defs>
            <LinearGradient id={id} x1={0} x2={0} y1={0} y2={1}>
              {stops.map((stop) => (
                <Stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={colors.background}
                  stopOpacity={stop.opacity}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            fill={`url(#${id})`}
            height={box.height}
            width={box.width}
            x={0}
            y={0}
          />
        </Svg>
      ) : null}
    </View>
  )
}
