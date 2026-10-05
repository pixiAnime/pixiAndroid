/**
 * The confirmation dialog every destructive Settings action goes through.
 *
 * It is a dumb surface: the page decides *what* is being confirmed and runs
 * the action, this only asks and waits for a yes. The wording comes from
 * `CONFIRM_DESC`, so adding an action never means editing JSX here.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { mobileKeys } from '@/i18n/mobile'

import { CONFIRM_DESC } from './confirm'
import type { ConfirmAction } from './types'

export function ConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  /** The pending action, or `null` when nothing is being confirmed. */
  action: ConfirmAction | null
  onCancel: () => void
  onConfirm: (action: ConfirmAction) => void
}) {
  const { t } = useTranslation()
  // Uninstalling extensions is awaited; keep the buttons disabled meanwhile so
  // a double tap cannot run it twice.
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!action) return
    setBusy(true)
    try {
      await onConfirm(action)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={action !== null}
      onClose={busy ? () => undefined : onCancel}
      title={t(mobileKeys.confirmTitle)}
      description={action ? t(CONFIRM_DESC[action]) : undefined}>
      <Button variant="ghost" disabled={busy} onPress={onCancel}>
        {t('common.cancel')}
      </Button>
      <Button variant="destructive" disabled={busy} onPress={confirm}>
        {t('common.yes')}
      </Button>
    </Dialog>
  )
}