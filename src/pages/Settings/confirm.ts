/**
 * Copy for the confirm-then-act dialog.
 *
 * Both maps are keyed by `ConfirmAction`, so the page never carries a
 * `switch` over strings just to pick text: the dialog asks for
 * `CONFIRM_DESC[action]` and, once it ran, reports `DONE_KEY[action]`.
 */
import { mobileKeys } from '@/i18n/mobile'

import type { ConfirmAction } from './types'

/** Body of the dialog, per action. */
export const CONFIRM_DESC: Record<ConfirmAction, string> = {
  history: mobileKeys.confirmClearHistory,
  myList: mobileKeys.confirmClearMyList,
  recent: mobileKeys.confirmClearRecent,
  cache: mobileKeys.confirmClearCache,
  extensions: mobileKeys.confirmClearExtensions,
  reset: mobileKeys.confirmReset,
}

/** Notice shown once the action finished. */
export const DONE_KEY: Record<ConfirmAction, string> = {
  history: mobileKeys.historyCleared,
  myList: mobileKeys.myListCleared,
  recent: mobileKeys.recentCleared,
  cache: mobileKeys.cacheCleared,
  extensions: mobileKeys.extensionsCleared,
  reset: mobileKeys.settingsReset,
}