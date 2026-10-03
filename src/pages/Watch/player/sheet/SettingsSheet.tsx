/**
 * SettingsSheet — the player's settings tree, now inside a `Sheet`.
 *
 * The tree itself is unchanged: `../../settingsMenu` still decides every page's
 * parent, `tests/settingsMenu.test.ts` still pins "a value is never more than
 * two taps from the root", and the rows are still `SettingsRow`. What changed
 * is the room it has to stand in.
 *
 * As a 168 px popover floating over the picture, the menu was fighting on two
 * axes at once: stay out of the controls, stay inside a 16:9 box that is only
 * ~230 px tall in portrait, and still fit nine rows. It coped by capping its own
 * height at 62% of the *video* and scrolling inside that, so a third of the
 * visible area was chrome and every row was 34 px — under a comfortable touch
 * target. Full-width at 82% of the *screen* it needs neither: each page fits,
 * the rows are 48 px, and the sheet is under the thumb rather than wherever the
 * video happened to leave room for it (§5, §18).
 *
 * Everything here is a *leaf*. The state lives in `Player`, which also owns the
 * video, the sleep-timer deadline, the rate ref the hold gesture restores, and
 * the hardware back key. The sheet draws and reports; it never decides.
 */
import { useCallback, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import Slider from '@react-native-community/slider'
import type { AudioTrack } from 'react-native-video'

import { colors, fonts, radii, spacing } from '@/theme'

import { SettingsBack, SettingsRow } from '../controls/SettingsRow'
import { formatRate } from '../format'
import { parentPage, type SettingsPage } from '../../settingsMenu'
import { DELAY_STEP, formatDelay, stepDelay } from '../../subtitleCues'
import { BOOST_CHOICES, SKIP_CHOICES } from '../../tapGestures'
import { playerWord, type PlayerWord } from '../../playerWords'
import { type SubtitleSize } from '../../subtitleScale'
import { Sheet } from './Sheet'

/** Every caption the menu can pick between — side-loaded and container tracks. */
export interface CaptionEntry {
  key: string
  label: string
  language: string
  format?: string
}

/** Playback rates offered in the settings menu (Vidstack's default set). */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
/** Sleep-timer steps in minutes; 0 means "off". */
const SLEEP_CHOICES = [0, 5, 10, 15, 30, 45] as const
/** Cue sizes offered in the settings menu, smallest first. */
const SUBTITLE_SIZES: SubtitleSize[] = ['small', 'medium', 'large']
/** …and the chrome word each one is labelled with. */
const SUBTITLE_SIZE_WORDS: Record<SubtitleSize, PlayerWord> = {
  small: 'sizeSmall',
  medium: 'sizeMedium',
  large: 'sizeLarge',
}

/**
 * What an audio track is called in a list. HLS variants usually carry a useful
 * `title` ("Japanese"), sometimes only a language code, and sometimes neither —
 * in which case the index is more honest than an empty row.
 */
function audioTrackLabel(track: AudioTrack | undefined): string {
  if (!track) return ''
  return track.title?.trim() || track.language?.trim() || `#${track.index}`
}

export interface SettingsSheetProps {
  visible: boolean
  /** The page the tree is currently showing. */
  page: SettingsPage
  onPage: (page: SettingsPage) => void
  onClose: () => void
  /** A touch inside the sheet still counts as a touch on the player behind it. */
  onInteract: () => void

  rate: number
  onRateChange: (rate: number) => void
  fillMode: boolean
  onFillModeChange: (fill: boolean) => void
  skipSeconds: number
  onSkipSecondsChange?: (seconds: number) => void
  holdRate: number
  onHoldRateChange?: (rate: number) => void
  /** Output level, 0–1. Dragged live, the way any player's volume bar is. */
  volume: number
  onVolumeChange?: (volume: number) => void
  audioTracks: AudioTrack[]
  audioIndex: number
  onAudioTrackChange: (index: number) => void
  /** Minutes left on the sleep timer, or `null` while it is off. */
  sleepMinutes: number | null
  onSleepChange: (minutes: number) => void

  /** Auto-next only offers anything when the page handed us an episode to go to. */
  autoNextAvailable: boolean
  autoNext: boolean
  onAutoNextChange?: (value: boolean) => void

  captionEntries: CaptionEntry[]
  activeSubtitleKey: string | null
  onSubtitleTrackChange: (key: string | null) => void
  subtitleSize: SubtitleSize
  onSubtitleSizeChange?: (size: SubtitleSize) => void
  subtitleDelay: number
  onSubtitleDelayChange?: (delay: number) => void
}

export function SettingsSheet(props: SettingsSheetProps) {
  const { t } = useTranslation()
  const {
    visible,
    page,
    onPage,
    onClose,
    onInteract,
    rate,
    onRateChange,
    fillMode,
    onFillModeChange,
    skipSeconds,
    onSkipSecondsChange,
    holdRate,
    onHoldRateChange,
    volume,
    onVolumeChange,
    audioTracks,
    audioIndex,
    onAudioTrackChange,
    sleepMinutes,
    onSleepChange,
    autoNextAvailable,
    autoNext,
    onAutoNextChange,
    captionEntries,
    activeSubtitleKey,
    onSubtitleTrackChange,
    subtitleSize,
    onSubtitleSizeChange,
    subtitleDelay,
    onSubtitleDelayChange,
  } = props

  const captionLabel = captionEntries.find((entry) => entry.key === activeSubtitleKey)?.label ?? ''
  const sleepLabel = sleepMinutes === null ? t('player.off') : `${sleepMinutes} min`

  /**
   * Every row that changes something starts here. A sheet is a layer *over* the
   * player, not a replacement for it, and the controls behind it hide on a timer
   * that any touch has to keep resetting — otherwise the bar can vanish while
   * the viewer is still reading which speed they are on.
   */
  const interact = onInteract

  /** Go a level deeper. */
  const open = useCallback(
    (target: SettingsPage) => () => {
      interact()
      onPage(target)
    },
    [interact, onPage],
  )

  /** Back walks up the tree first, exactly as the popover's listener did — it
   *  just arrives through the Modal now instead of `BackHandler`. */
  const handleBack = useCallback(() => {
    const parent = parentPage(page)
    if (parent) onPage(parent)
    else onClose()
  }, [onClose, onPage, page])

  /**
   * The heading a page's back row carries: the name of the page *above* it.
   * Getting this wrong is not cosmetic — the row is the only thing telling the
   * viewer where back goes, and "‹ PLAYBACK" on the way to the root would be a
   * lie. The root's own name is the settings word, so the two group pages both
   * read "‹ SETTINGS" under a header that already says SETTINGS; that is
   * deliberate redundancy, not an oversight (and matches the popover).
   */
  const parent = parentPage(page)
  const backLabel =
    parent === 'playback'
      ? playerWord('playback')
      : parent === 'subtitles'
        ? t('common.subtitles')
        : playerWord('settings')

  return (
    <Sheet onClose={onClose} onBack={handleBack} title={playerWord('settings')} visible={visible}>
      {/* The sheet owns the scroll viewport (see `Sheet`); this is only the rows. */}
      <View style={styles.rows}>
        {page !== 'root' ? <SettingsBack label={backLabel} onPress={handleBack} /> : null}

        {page === 'root' ? (
          <>
            <SettingsRow
              label={playerWord('playback')}
              opens
              onPress={open('playback')}
              trailing={`${formatRate(rate)} · ${fillMode ? playerWord('fill') : playerWord('fit')}`}
            />
            <SettingsRow
              label={t('common.subtitles')}
              opens
              onPress={open('subtitles')}
              trailing={`${activeSubtitleKey === null ? t('player.off') : captionLabel} · ${playerWord(SUBTITLE_SIZE_WORDS[subtitleSize])}`}
            />
          </>
        ) : null}

        {page === 'playback' ? (
          <>
            <SettingsRow
              label={playerWord('speed')}
              opens
              onPress={open('speed')}
              trailing={formatRate(rate)}
            />
            <SettingsRow
              label={playerWord('display')}
              opens
              onPress={open('display')}
              trailing={fillMode ? playerWord('fill') : playerWord('fit')}
            />
            <SettingsRow
              label={playerWord('skip')}
              opens
              onPress={open('skip')}
              trailing={`${skipSeconds}s`}
            />
            <SettingsRow
              label={playerWord('holdSpeed')}
              opens
              onPress={open('hold')}
              trailing={formatRate(holdRate)}
            />
            {/* A slider, not a list: volume is a range, and dragging *is* the
                control. It lives inline on this page so the level is one tap
                from the gear, beside the other Playback rows. */}
            {onVolumeChange ? (
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>{playerWord('volume')}</Text>
                <View style={styles.sliderWrap}>
                  <Slider
                    accessibilityLabel={playerWord('volume')}
                    maximumTrackTintColor={colors.input}
                    maximumValue={1}
                    minimumTrackTintColor={colors.primary}
                    minimumValue={0}
                    onSlidingStart={interact}
                    onValueChange={onVolumeChange}
                    step={0.05}
                    style={styles.slider}
                    thumbTintColor={colors.primary}
                    value={volume}
                  />
                  <Text style={styles.sliderValue}>{Math.round(volume * 100)}%</Text>
                </View>
              </View>
            ) : null}
            {/* A stream with one audio track has nothing to choose, so the row
                only exists when there is a real second option. */}
            {audioTracks.length > 1 ? (
              <SettingsRow
                label={playerWord('audio')}
                opens
                onPress={open('audio')}
                trailing={audioTrackLabel(audioTracks[audioIndex] ?? audioTracks[0])}
              />
            ) : null}
            <SettingsRow
              label={playerWord('sleepTimer')}
              opens
              onPress={open('sleep')}
              trailing={sleepLabel}
            />
            {/* A switch, not a list: two rows of which one is the other is a
                worse way to say yes or no. */}
            {autoNextAvailable ? (
              <SettingsRow
                label={playerWord('autoNext')}
                onPress={() => {
                  interact()
                  onAutoNextChange?.(!autoNext)
                }}
                trailing={autoNext ? playerWord('on') : t('player.off')}
              />
            ) : null}
          </>
        ) : null}

        {page === 'subtitles' ? (
          <>
            <SettingsRow
              label={playerWord('track')}
              opens
              onPress={open('track')}
              trailing={activeSubtitleKey === null ? t('player.off') : captionLabel}
            />
            <SettingsRow
              label={playerWord('size')}
              opens
              onPress={open('cueSize')}
              trailing={playerWord(SUBTITLE_SIZE_WORDS[subtitleSize])}
            />
            {/* The stepper is a control, so it belongs on the summary row
                rather than behind a page of its own. */}
            {onSubtitleDelayChange ? (
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>{t('player.delayLabel')}</Text>
                <View style={styles.stepper}>
                  <Chip
                    label={t('player.delayDecrease')}
                    onPress={() => {
                      interact()
                      onSubtitleDelayChange(stepDelay(subtitleDelay, -DELAY_STEP))
                    }}>
                    −
                  </Chip>
                  <Chip
                    label={t('player.delayReset')}
                    onPress={() => {
                      interact()
                      onSubtitleDelayChange(0)
                    }}
                    value={formatDelay(subtitleDelay)}
                  />
                  <Chip
                    label={t('player.delayIncrease')}
                    onPress={() => {
                      interact()
                      onSubtitleDelayChange(stepDelay(subtitleDelay, DELAY_STEP))
                    }}>
                    +
                  </Chip>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {page === 'speed'
          ? SPEEDS.map((value) => (
              <SettingsRow
                key={value}
                label={formatRate(value)}
                onPress={() => {
                  interact()
                  onRateChange(value)
                  onPage('playback')
                }}
                selected={rate === value}
              />
            ))
          : null}

        {page === 'display'
          ? [false, true].map((fill) => (
              <SettingsRow
                key={fill ? 'fill' : 'fit'}
                label={fill ? playerWord('fill') : playerWord('fit')}
                onPress={() => {
                  interact()
                  onFillModeChange(fill)
                  onPage('playback')
                }}
                selected={fillMode === fill}
              />
            ))
          : null}

        {page === 'skip'
          ? SKIP_CHOICES.map((seconds) => (
              <SettingsRow
                key={seconds}
                label={`${seconds}s`}
                onPress={() => {
                  interact()
                  onSkipSecondsChange?.(seconds)
                  onPage('playback')
                }}
                selected={skipSeconds === seconds}
              />
            ))
          : null}

        {page === 'hold'
          ? BOOST_CHOICES.map((value) => (
              <SettingsRow
                key={value}
                label={formatRate(value)}
                onPress={() => {
                  interact()
                  onHoldRateChange?.(value)
                  onPage('playback')
                }}
                selected={holdRate === value}
              />
            ))
          : null}

        {page === 'sleep'
          ? SLEEP_CHOICES.map((minutes) => (
              <SettingsRow
                key={minutes}
                label={minutes === 0 ? t('player.off') : `${minutes} min`}
                onPress={() => {
                  interact()
                  onSleepChange(minutes)
                  onPage('playback')
                }}
                selected={
                  minutes === 0 ? sleepMinutes === null : sleepMinutes === minutes
                }
              />
            ))
          : null}

        {page === 'audio'
          ? audioTracks.map((track, index) => (
              <SettingsRow
                key={track.index}
                label={audioTrackLabel(track)}
                onPress={() => {
                  interact()
                  onAudioTrackChange(index)
                  onPage('playback')
                }}
                selected={index === audioIndex}
              />
            ))
          : null}

        {page === 'cueSize'
          ? SUBTITLE_SIZES.map((size) => (
              <SettingsRow
                key={size}
                label={playerWord(SUBTITLE_SIZE_WORDS[size])}
                onPress={() => {
                  interact()
                  onSubtitleSizeChange?.(size)
                  onPage('subtitles')
                }}
                selected={subtitleSize === size}
              />
            ))
          : null}

        {page === 'track' ? (
          <>
            <SettingsRow
              label={t('player.off')}
              labelFor={t('player.subsOffAria')}
              onPress={() => {
                interact()
                onSubtitleTrackChange(null)
                onPage('subtitles')
              }}
              selected={activeSubtitleKey === null}
            />
            {captionEntries.map((entry) => (
              <SettingsRow
                key={entry.key}
                label={entry.label}
                labelFor={
                  entry.format
                    ? t('player.subsForAria', {
                        label: entry.label,
                        language: entry.language,
                        format: entry.format,
                      })
                    : entry.label
                }
                onPress={() => {
                  interact()
                  onSubtitleTrackChange(entry.key)
                  onPage('subtitles')
                }}
                selected={entry.key === activeSubtitleKey}
              />
            ))}
          </>
        ) : null}
      </View>
    </Sheet>
  )
}

/** One cell of the subtitle-delay stepper. */
function Chip({
  label,
  onPress,
  children,
  value,
}: {
  label: string
  onPress: () => void
  children?: ReactNode
  /** The value form (a number); omit it for the glyph form. */
  value?: string
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
      <Text style={value === undefined ? styles.chipGlyph : styles.chipValue}>{value ?? children}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  /** Padding below the last row so it does not sit on the sheet's bottom edge. */
  rows: { paddingBottom: spacing.sm },
  stepperRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  stepperLabel: {
    fontFamily: fonts.medium,
    fontSize: 13.6,
    lineHeight: 18,
    color: colors.foreground,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /** The volume slider: label left, rail + percentage right, on one row. */
  sliderWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  slider: { flex: 1, height: 40, maxWidth: 200 },
  sliderValue: {
    minWidth: 36,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
    fontVariant: ['tabular-nums'],
  },
  /**
   * 44 × 36 rather than the popover's 32 × 24. The buttons sit side by side, so
   * they keep a comfortable width but are allowed to be shorter than they are
   * wide — the row they live in is 48 tall and the label takes the rest.
   */
  chip: {
    minWidth: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radii.badge,
    paddingHorizontal: spacing.sm,
  },
  chipPressed: { backgroundColor: colors.secondary },
  chipGlyph: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 18, color: colors.foreground },
  chipValue: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
})
