/**
 * The bottom bar's *filled* glyphs — the half of Material 3's navigation-bar
 * rule that `lucide-react-native` cannot supply. M3 states it plainly:
 *
 *   "In Material Design 3, inactive destinations are indicated by an outlined
 *    version of the icon if available. Active destinations are indicated by a
 *    filled icon enclosed in a pill shaped container."
 *
 * lucide ships outline icons only, and simply handing a lucide icon `fill`
 * does not produce a solid glyph: `fill-rule` only decides how the sub-paths
 * of **one** path combine, so lucide's separate `<circle>` (the gear's hole)
 * and `<path>` (the house's door) paint straight *over* the fill instead of
 * cutting it out — you get a house-shaped blob and a gear-shaped blob.
 *
 * So the two glyphs that need a cut-out are lucide's own path data with the
 * missing sub-path appended to the same `d`, rendered `fillRule="evenodd"`:
 * the interior flips back out and the door / centre hole return. Browse and
 * Search have no cut-out to lose, so they stay exactly as lucide draws them
 * and only gain `fill`.
 *
 * Every path here is a copy of lucide's, not a redraw, so the outlined and
 * filled states of a destination are recognisably the same glyph — which is
 * what makes the outlined↔filled swap read as a state change rather than an
 * icon change.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'

/** Matches what `BottomNav` passes the outlined icons: 24dp at 1.8 stroke. */
export interface NavGlyphProps {
  size?: number
  color?: string
  strokeWidth?: number
}

/**
 * lucide `house`, with its door sub-path (`M15 21v-8…`) appended after a
 * space. The door runs down to y=21 — the same edge as the house's floor —
 * so cutting it out opens a doorway at the bottom instead of a slot.
 */
const HOME_PATH =
  'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z ' +
  'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8z'

/**
 * lucide `settings`, plus the centre circle rewritten as a sub-path
 * (`M15 12 … 3 … 6 0z` — start at 3 o'clock, two arcs of r=3). `evenodd`
 * turns it into the hole a filled Material gear always has; without it the
 * gear is an unreadable flower.
 */
const SETTINGS_PATH =
  'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915 ' +
  'M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z'

/** lucide `layout-grid`: four 7×7 rounded squares, all solid. */
const GRID_TILES: ReadonlyArray<readonly [x: number, y: number]> = [
  [3, 3],
  [14, 3],
  [14, 14],
  [3, 14],
]

/** One filled, stroked path — the stroke is what keeps its edge rounded. */
function glyph(d: string, color: string, strokeWidth: number, fillRule?: 'evenodd') {
  return (
    <Path
      d={d}
      fill={fillRule ? color : 'none'}
      fillRule={fillRule}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export function HomeFilled({ size = 24, color = '#E4E6E8', strokeWidth = 1.8 }: NavGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {glyph(HOME_PATH, color, strokeWidth, 'evenodd')}
    </Svg>
  )
}

export function BrowseFilled({ size = 24, color = '#E4E6E8', strokeWidth = 1.8 }: NavGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {GRID_TILES.map(([x, y]) => (
        <Rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={7}
          height={7}
          rx={1}
          fill={color}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

export function SearchFilled({ size = 24, color = '#E4E6E8', strokeWidth = 1.8 }: NavGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {/* The lens is a solid disc; the handle has no area of its own, so it
          only exists as a stroke — hence `fill` on the circle, not on it. */}
      <Circle cx={11} cy={11} r={8} fill={color} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="m21 21-4.34-4.34"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export function SettingsFilled({ size = 24, color = '#E4E6E8', strokeWidth = 1.8 }: NavGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {glyph(SETTINGS_PATH, color, strokeWidth, 'evenodd')}
    </Svg>
  )
}
