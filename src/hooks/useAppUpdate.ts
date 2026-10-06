/**
 * `useAppUpdate` — "is there a newer APK, and put it on screen".
 *
 * One check per app session (react-query, four-hour staleness so a session
 * left open does not poll GitHub), mounted by the header that renders the
 * button. A failed check resolves to *no update*: the button's absence is the
 * normal state of an up-to-date install, and the header must never turn into
 * an error surface because GitHub was briefly unreachable.
 *
 * The button only ever means "download and install now" — see `install`,
 * which reports the two things Android can say back (`permission`, `open`)
 * and the one it cannot do at all (`missing`).
 */
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchLatestUpdate, type UpdateInfo } from '@/api/update/latest'
import { mobileKeys } from '@/i18n/mobile'
import { currentVersion, installUpdate } from '@/platform/update'

const STALE_MS = 4 * 60 * 60_000

export interface AppUpdate {
  /** A published APK newer than this install, or `null`. */
  update: UpdateInfo | null
  /** True from the tap until Android answers — drives the spinner. */
  installing: boolean
  /** Download the APK and hand it to the installer. */
  install: () => Promise<void>
}

export function useAppUpdate(): AppUpdate {
  const { t } = useTranslation()
  const [installing, setInstalling] = useState(false)

  const query = useQuery({
    queryKey: ['app-update'],
    queryFn: async ({ signal }) => {
      const current = await currentVersion()
      if (!current) return null
      return fetchLatestUpdate(current, signal)
    },
    staleTime: STALE_MS,
    retry: 1,
  })

  const install = useCallback(async () => {
    const pending = query.data
    if (!pending || installing) return
    setInstalling(true)
    try {
      const result = await installUpdate(pending.apkUrl)
      if (result === 'permission') {
        // The system screen is already open behind the dialog: this is the
        // "allow it, then tap again" step, not an error.
        Alert.alert(t(mobileKeys.updatePermTitle), t(mobileKeys.updatePermBody))
      }
      // `open` puts the system install prompt up; `missing` is a build without
      // the native module, where there is nothing to offer either.
    } catch {
      Alert.alert(t(mobileKeys.updateFailedTitle), t(mobileKeys.updateFailedBody))
    } finally {
      setInstalling(false)
    }
  }, [installing, query.data, t])

  return { update: query.data ?? null, installing, install }
}
