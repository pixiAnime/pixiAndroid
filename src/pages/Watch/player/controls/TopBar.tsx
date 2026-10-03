/**
 * TopBar — the strip the picture loses to at its top edge (§14).
 *
 * The bottom dock answers "how do I control this?"; the top bar answers "what
 * is this, and how do I move through it?". It therefore holds the two things
 * the dock has no room for:
 *
 *  - **the title**, but only in fullscreen. Portrait shows the page's own
 *    header directly under the video, and printing the same title twice a
 *    screen apart is noise; in fullscreen that header is gone, so the player
 *    has to say what it is playing itself.
 *  - **episode navigation** — previous, next, and the list behind them. This
 *    is the "full episode nav in player" the redesign asks for: three taps
 *    from any frame to any episode, without ever leaving the surface.
 *
 * The back chevron is fullscreen-only for the same reason: in portrait the
 * page already owns a back bar, and two backs on one screen is a coin toss.
 *
 * ## Why it is a Fragment
 *
 * It renders `<Scrim>` and its row as siblings rather than inside a wrapper of
 * its own, so that the positioned box is `Player`'s own animated `View`
 * (`styles.topBar`) and both land directly in it — the same arrangement the
 * dock uses, where the scrim measures the box that is actually animating
 * rather than a static child nested inside it.
 *
 * It shares the dock's `Animated.Value` (see `Player`), so the two ends of the
 * frame cannot disagree about whether the controls are up: the bar leaves by
 * sliding *outward* — `-8 → 0` — while everything below slides inward.
 */
import { Fragment } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ListVideo, SkipBack, SkipForward } from '@/components/icons'

import { colors, fonts, radii, spacing } from '@/theme'

import { playerWord } from '../../playerWords'
import { Scrim } from '../Scrim'

export interface TopBarProps {
  /** One line of "what is playing". Rendered only when `showLabel`. */
  label: string
  /** Whether the title earns its place — set from `fullscreen` in `Player`. */
  showLabel?: boolean
  /** Leave fullscreen. Absent in portrait, where the page owns a back bar. */
  onExitFullscreen?: (() => void) | undefined
  onPrevEpisode?: (() => void) | undefined
  onNextEpisode?: (() => void) | undefined
  /** Opens the episode sheet; absent while there is no list to show. */
  onEpisodes?: (() => void) | undefined
  /** True while that sheet is up, so the icon can say so. */
  episodesActive?: boolean
}

export function TopBar({
  label,
  showLabel = false,
  onExitFullscreen,
  onPrevEpisode,
  onNextEpisode,
  onEpisodes,
  episodesActive = false,
}: TopBarProps) {
  /** Episode nav only appears once there is somewhere to go. */
  const hasEpisodeNav = onEpisodes !== undefined

  return (
    <Fragment>
      <Scrim edge="top" />
      <View pointerEvents="box-none" style={styles.row}>
        {onExitFullscreen ? (
          <Pressable
            accessibilityLabel={playerWord('exitFullscreen')}
            accessibilityRole="button"
            hitSlop={6}
            onPress={onExitFullscreen}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ChevronLeft size={18} color={colors.foreground} strokeWidth={1.6} />
          </Pressable>
        ) : null}

        {/* `minWidth: 0` is load-bearing: without it a flex child refuses to
            shrink below its text and `numberOfLines` can never ellipsize. */}
        <View style={styles.grow}>
          {showLabel ? (
            <Text numberOfLines={1} style={styles.title}>
              {label}
            </Text>
          ) : null}
        </View>

        {hasEpisodeNav ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={playerWord('prevEpisode')}
              accessibilityRole="button"
              disabled={onPrevEpisode === undefined}
              hitSlop={6}
              onPress={() => onPrevEpisode?.()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                onPrevEpisode === undefined && styles.dimmed,
              ]}>
              <SkipBack size={16} color={colors.foreground} strokeWidth={1.6} />
            </Pressable>

            <Pressable
              accessibilityLabel={playerWord('episodes')}
              accessibilityRole="button"
              accessibilityState={{ expanded: episodesActive }}
              hitSlop={6}
              onPress={() => onEpisodes?.()}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <ListVideo size={16} color={colors.foreground} strokeWidth={1.6} />
            </Pressable>

            <Pressable
              accessibilityLabel={playerWord('nextEpisode')}
              accessibilityRole="button"
              disabled={onNextEpisode === undefined}
              hitSlop={6}
              onPress={() => onNextEpisode?.()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                onNextEpisode === undefined && styles.dimmed,
              ]}>
              <SkipForward size={16} color={colors.foreground} strokeWidth={1.6} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Fragment>
  )
}

const styles = StyleSheet.create({
  /**
   * 2 + 28 + 56 = 86 px tall, of which only the top 30 is content.
   *
   * The other 56 is the gradient's run, and it is not decoration: `TOP_STOPS`
   * reaches 0.36 at 45% of the box, so the row's own centre (16 px in) sits at
   * ~0.64 black — enough for white type over a bright frame — while the ramp
   * still reaches full transparency a full 50 px before it could meet the
   * centre controls. An 86 px top scrim and the dock's 96 px leave a clean
   * window in between rather than two panels with a gap, which is the whole
   * argument for using a gradient at all.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    paddingBottom: 56,
    paddingHorizontal: spacing.sm,
  },
  grow: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.foreground,
    paddingHorizontal: spacing.xs,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /** 28 px of glyph in a 32 px row; `hitSlop` supplies the comfortable target. */
  button: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  pressed: { backgroundColor: colors.overlay },
  /** There is no previous/next episode — still shown, so the count reads. */
  dimmed: { opacity: 0.32 },
})
