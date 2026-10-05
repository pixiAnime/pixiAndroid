/**
 * Playback defaults — everything the player used to bury in its own gear
 * menu. Each row owns its storage key through `usePreference`, so the panel
 * only decides the order the options appear in.
 *
 * Rendered without a panel header: the category tab above it already says
 * "Playback", and the only thing worth labelling on the rows is the language,
 * not the section they live in.
 */
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/Switch'
import { mobileKeys } from '@/i18n/mobile'

import { Panel, SettingChoice, SettingRow } from '../components'
import { usePreference } from '../usePreference'
import { BOOST_CHOICES, SKIP_CHOICES } from '../../Watch/tapGestures'
import {
  readAutoNext,
  readHoldRate,
  readSkipSeconds,
  readSubtitleLanguage,
  readSubtitleSize,
  readVolume,
  SUBTITLE_LANGUAGE_CHOICES,
  SUBTITLE_SIZE_CYCLE,
  writeAutoNext,
  writeHoldRate,
  writeSkipSeconds,
  writeSubtitleLanguage,
  writeSubtitleSize,
  writeVolume,
} from '../../Watch/playerPrefs'
import type { SubtitleSize } from '../../Watch/subtitleScale'

/** Output levels the player can open at. 100% is the last pill, not the only safe one. */
const VOLUME_CHOICES = [0.25, 0.5, 0.75, 1] as const

export function PlaybackPanel({ resetKey }: { resetKey: number }) {
  const { t } = useTranslation()

  const [autoNext, setAutoNext] = usePreference(readAutoNext, writeAutoNext, resetKey)
  const [skipSeconds, setSkipSeconds] = usePreference(readSkipSeconds, writeSkipSeconds, resetKey)
  const [holdRate, setHoldRate] = usePreference(readHoldRate, writeHoldRate, resetKey)
  // The reader needs a size to fall back on; the stored key is always one of
  // the three, so the default never survives a render.
  const [subtitleSize, setSubtitleSize] = usePreference<SubtitleSize>(
    () => readSubtitleSize('medium'),
    writeSubtitleSize,
    resetKey,
  )
  const [subtitleLanguage, setSubtitleLanguage] = usePreference(
    readSubtitleLanguage,
    writeSubtitleLanguage,
    resetKey,
  )
  const [volume, setVolume] = usePreference(readVolume, writeVolume, resetKey)

  return (
    <Panel ariaLabel={t(mobileKeys.playbackAria)}>
      <SettingRow
        first
        title={t(mobileKeys.autoplayNext)}
        description={t(mobileKeys.autoplayNextDesc)}>
        <Switch
          value={autoNext}
          accessibilityLabel={t(mobileKeys.autoplayNext)}
          onValueChange={setAutoNext}
        />
      </SettingRow>

      <SettingChoice
        title={t(mobileKeys.skipInterval)}
        description={t(mobileKeys.skipIntervalDesc)}
        value={skipSeconds}
        options={SKIP_CHOICES}
        format={(value) => `${value}s`}
        onChange={setSkipSeconds}
      />

      <SettingChoice
        title={t(mobileKeys.holdSpeed)}
        description={t(mobileKeys.holdSpeedDesc)}
        value={holdRate}
        options={BOOST_CHOICES}
        format={(value) => `${value}×`}
        onChange={setHoldRate}
      />

      <SettingChoice
        title={t(mobileKeys.subtitleSize)}
        description={t(mobileKeys.subtitleSizeDesc)}
        value={subtitleSize}
        options={SUBTITLE_SIZE_CYCLE}
        format={(value) => t(SUBTITLE_SIZE_KEY[value])}
        onChange={setSubtitleSize}
      />

      <SettingChoice
        title={t(mobileKeys.subtitleLanguage)}
        description={t(mobileKeys.subtitleLanguageDesc)}
        value={subtitleLanguage}
        options={SUBTITLE_LANGUAGE_CHOICES}
        format={(value) =>
          value === 'auto' ? t(mobileKeys.subtitleAuto) : value.toUpperCase()
        }
        onChange={setSubtitleLanguage}
      />

      <SettingChoice
        title={t(mobileKeys.defaultVolume)}
        description={t(mobileKeys.defaultVolumeDesc)}
        value={volume}
        options={VOLUME_CHOICES}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={setVolume}
      />
    </Panel>
  )
}

/**
 * The pills show translated words rather than the raw `SubtitleSize` value —
 * `SettingChoice` falls back to `String(value)` when a row has no formatter.
 */
const SUBTITLE_SIZE_KEY = {
  small: mobileKeys.subtitleSmall,
  medium: mobileKeys.subtitleMedium,
  large: mobileKeys.subtitleLarge,
} as const satisfies Record<SubtitleSize, string>