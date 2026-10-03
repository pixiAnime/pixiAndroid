/**
 * Cue sizing, shared by the two ways subtitles reach the screen.
 *
 * Side-loaded tracks are drawn as an RN `Text` overlay, container tracks are
 * drawn by ExoPlayer from `subtitleStyle.fontSize` — two very different code
 * paths that have to agree, or switching a track silently changes the size.
 * So both read these numbers, and the default is what `NATIVE_SUBTITLE_STYLE`
 * pinned before the setting existed: 16sp cues, 22sp line height.
 *
 * Line height has to move with the font size; leaving it fixed is what makes a
 * scaled-up cue box clip its descenders.
 */
export type SubtitleSize = 'small' | 'medium' | 'large'

interface CueMetrics {
  /** RN overlay font size, in the same dp the styles are written in. */
  fontSize: number
  /** RN overlay line height. */
  lineHeight: number
  /** ExoPlayer's `subtitleStyle.fontSize`, in sp. */
  nativeFontSize: number
}

export const CUE_METRICS: Record<SubtitleSize, CueMetrics> = {
  small: { fontSize: 14, lineHeight: 20, nativeFontSize: 14 },
  medium: { fontSize: 16, lineHeight: 22, nativeFontSize: 16 },
  large: { fontSize: 20, lineHeight: 28, nativeFontSize: 20 },
}

export function cueMetrics(size: SubtitleSize): CueMetrics {
  return CUE_METRICS[size] ?? CUE_METRICS.medium
}
