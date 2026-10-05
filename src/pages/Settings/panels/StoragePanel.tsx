/**
 * Storage maintenance — the cache and the installed extensions. Both are
 * recoverable, but neither is free to rebuild, so both confirm first.
 */
import { useTranslation } from 'react-i18next'

import { useExtensionRegistry } from '@/extensions/runtime/ExtensionRegistry'
import { mobileKeys } from '@/i18n/mobile'

import { ActionRow, Panel } from '../components'
import type { ConfirmAction } from '../types'

export function StoragePanel({ onRequest }: { onRequest: (action: ConfirmAction) => void }) {
  const { t } = useTranslation()
  const extensionCount = useExtensionRegistry((s) => s.records.length)

  return (
    <Panel label={t(mobileKeys.storageHeading)} ariaLabel={t(mobileKeys.storageAria)}>
      <ActionRow
        first
        title={t(mobileKeys.clearCache)}
        description={t(mobileKeys.clearCacheDesc)}
        actionLabel={t(mobileKeys.clearCache)}
        onPress={() => onRequest('cache')}
      />

      <ActionRow
        title={t(mobileKeys.clearExtensionsData)}
        description={t(mobileKeys.clearExtensionsDataDesc)}
        actionLabel={t(mobileKeys.clearExtensionsData)}
        destructive
        // Nothing installed means nothing to remove — say so instead of
        // offering an action that would only re-fetch.
        disabled={extensionCount === 0}
        onPress={() => onRequest('extensions')}
      />
    </Panel>
  )
}