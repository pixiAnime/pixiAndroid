/**
 * Appearance — how the app looks and what it shows: which title is picked,
 * whether adult titles are listed at all, and whether video fills the screen
 * or fits inside it. These are the settings a user changes once and then
 * forgets, so they sit together under one heading.
 */
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/Switch'
import { mobileKeys } from '@/i18n/mobile'
import {
  readHideAdult,
  readTitleLanguage,
  TITLE_LANGUAGES,
  writeHideAdult,
  writeTitleLanguage,
  type TitleLanguage,
} from '@/lib/contentPreferences'
import { readFillMode, writeFillMode } from '../../Watch/playerPrefs'

import { Panel, SettingChoice, SettingRow } from '../components'
import { usePreference } from '../usePreference'

export function AppearancePanel({ resetKey }: { resetKey: number }) {
  const { t } = useTranslation()

  const [titleLanguage, setTitleLanguage] = usePreference<TitleLanguage>(
    readTitleLanguage,
    writeTitleLanguage,
    resetKey,
  )
  const [hideAdult, setHideAdult] = usePreference(readHideAdult, writeHideAdult, resetKey)
  const [fillMode, setFillMode] = usePreference(readFillMode, writeFillMode, resetKey)

  return (
    <Panel ariaLabel={t(mobileKeys.contentAria)}>
      <SettingChoice
        first
        title={t(mobileKeys.titleLanguage)}
        description={t(mobileKeys.titleLanguageDesc)}
        value={titleLanguage}
        options={TITLE_LANGUAGES}
        format={(value) => t(TITLE_LANGUAGE_KEY[value])}
        onChange={setTitleLanguage}
      />

      <SettingRow title={t(mobileKeys.hideAdult)} description={t(mobileKeys.hideAdultDesc)}>
        <Switch
          value={hideAdult}
          accessibilityLabel={t(mobileKeys.hideAdult)}
          onValueChange={setHideAdult}
        />
      </SettingRow>

      <SettingRow title={t(mobileKeys.fillToggle)} description={t(mobileKeys.fillToggleDesc)}>
        <Switch
          value={fillMode}
          accessibilityLabel={t(mobileKeys.fillToggle)}
          onValueChange={setFillMode}
        />
      </SettingRow>
    </Panel>
  )
}

/** Pill labels, kept out of the JSX so the choice list reads top to bottom. */
const TITLE_LANGUAGE_KEY = {
  en: mobileKeys.titleEn,
  romaji: mobileKeys.titleRomaji,
  native: mobileKeys.titleNative,
} as const satisfies Record<TitleLanguage, string>