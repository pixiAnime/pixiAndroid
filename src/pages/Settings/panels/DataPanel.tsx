/**
 * Data & privacy — the four actions that erase what the user watched or
 * saved, plus the settings reset. All of them are destructive, so all of them
 * go through the same confirm dialog owned by the page.
 */
import { useTranslation } from 'react-i18next'

import { mobileKeys } from '@/i18n/mobile'

import { ActionRow, Panel } from '../components'
import type { ConfirmAction } from '../types'

export function DataPanel({ onRequest }: { onRequest: (action: ConfirmAction) => void }) {
  const { t } = useTranslation()

  return (
    <Panel label={t(mobileKeys.dataHeading)} ariaLabel={t(mobileKeys.dataAria)}>
      <ActionRow
        first
        title={t(mobileKeys.clearHistory)}
        description={t(mobileKeys.clearHistoryDesc)}
        actionLabel={t('common.remove')}
        destructive
        onPress={() => onRequest('history')}
      />

      <ActionRow
        title={t(mobileKeys.clearMyList)}
        description={t(mobileKeys.clearMyListDesc)}
        actionLabel={t('common.remove')}
        destructive
        onPress={() => onRequest('myList')}
      />

      <ActionRow
        title={t(mobileKeys.clearRecent)}
        description={t(mobileKeys.clearRecentDesc)}
        actionLabel={t('common.remove')}
        destructive
        onPress={() => onRequest('recent')}
      />

      <ActionRow
        title={t(mobileKeys.resetSettings)}
        description={t(mobileKeys.resetSettingsDesc)}
        actionLabel={t(mobileKeys.resetSettings)}
        destructive
        onPress={() => onRequest('reset')}
      />
    </Panel>
  )
}