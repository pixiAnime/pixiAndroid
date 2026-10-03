/**
 * CueOverlay — the side-loaded subtitle drawing, moved out of `Player` for one
 * specific reason: it is the *other* thing that depends on the playhead.
 *
 * The player draws cues as RN `Text` (Vidstack would parse a Blob URL itself;
 * ExoPlayer only renders container tracks, so side-loaded ones are ours — see
 * the file header of `../Player.tsx`). Computing which cues are active needs
 * `position`, and if that came through props the whole player would re-render
 * four times a second just to change a line of text.
 *
 * So it subscribes directly, and with a selector that returns the **joined
 * string** rather than the position. String comparison is by value, so React
 * re-renders this leaf only when the visible text actually changes — once per
 * cue boundary, not once per tick. `selectActiveCues` is a linear scan over
 * the track, which is cheap enough to run four times a second and is not worth
 * an index for a few hundred cues.
 */
import { StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/theme'

import { usePlayhead } from './playhead'
import { selectActiveCues } from '../subtitleCues'
import type { ResolvedSubtitleTrack } from '../subtitleTracks'

export interface CueOverlayProps {
  /** The side-loaded track being drawn; `null` when off or a container track. */
  track: ResolvedSubtitleTrack | null
  /** Manual sync offset in seconds, applied to both ends of every cue. */
  delay: number
  fontSize: number
  lineHeight: number
}

export function CueOverlay({ track, delay, fontSize, lineHeight }: CueOverlayProps) {
  const text = usePlayhead((state) =>
    track
      ? selectActiveCues(track.cues, state.position, delay)
          .map((cue) => cue.text)
          .join('\n')
      : '',
  )

  if (!text) return null

  return (
    <View importantForAccessibility="no" pointerEvents="none" style={styles.box}>
      <Text style={[styles.cue, { fontSize, lineHeight }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * Clears the bottom dock rather than sitting on it.
   *
   * The dock is 96 px tall (44 px of gradient above 52 px of controls), and the
   * preview card that appears during a scrub reaches to about y=96 — so a cue
   * anchored any lower would be slid aside by the viewer's own thumb. The
   * matching ExoPlayer padding for container tracks is eight pixels below this,
   * exactly as it was before the split, because the two rendering paths are
   * different code but must not disagree about where subtitles live.
   */
  box: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 72,
    alignItems: 'center',
  },
  cue: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: '100%',
  },
})
