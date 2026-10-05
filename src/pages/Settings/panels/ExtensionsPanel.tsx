/**
 * Extension preferences: whether manifests are refreshed when the Extensions
 * page opens, and the way in to managing repositories and providers.
 */
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/ui/Switch'
import { mobileKeys } from '@/i18n/mobile'
import { readAutoCheckUpdates, writeAutoCheckUpdates } from '@/lib/appSettings'

import { ActionRow, Panel, SettingRow } from '../components'
import { usePreference } from '../usePreference'
import type { SettingsNav } from '../types'

export function ExtensionsPanel({ resetKey }: { resetKey: number }) {
  const { t } = useTranslation()
  const navigation = useNavigation<SettingsNav>()

  const [autoCheck, setAutoCheck] = usePreference(
    readAutoCheckUpdates,
    writeAutoCheckUpdates,
    resetKey,
  )

  return (
    <Panel ariaLabel={t(mobileKeys.extensionsAria)}>
      <SettingRow
        first
        title={t(mobileKeys.autoCheckUpdates)}
        description={t(mobileKeys.autoCheckUpdatesDesc)}>
        <Switch
          value={autoCheck}
          accessibilityLabel={t(mobileKeys.autoCheckUpdates)}
          onValueChange={setAutoCheck}
        />
      </SettingRow>

      <ActionRow
        title={t(mobileKeys.manageRepos)}
        description={t('settings.sectionExtensionsDesc')}
        actionLabel={t('nav.extensions')}
        onPress={() => navigation.navigate('Extensions')}
      />
    </Panel>
  )
}