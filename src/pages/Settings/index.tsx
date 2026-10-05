/**
 * Settings — the app's full preferences hub.
 *
 * The page is split into five categories (see `tabs.ts`) so a long list of
 * unrelated switches does not arrive as one wall: the strip under the heading
 * switches between them, and only the selected category's panels are mounted.
 *
 * This file is deliberately a shell: it renders the header, the connection
 * status, the tab strip and the panels, and owns the only state that is
 * genuinely page-wide — the selected category, which destructive action is
 * awaiting confirmation, the notice reported afterwards, and the counter that
 * tells every panel to re-read storage after a reset. Each group of rows lives
 * in `panels/`, built from the primitives in `components.tsx`.
 *
 * Beyond the sections that left the nav (History, My List, Extensions), the
 * language picker and the About panel, this surfaces the playback defaults
 * the player used to bury in its own gear menu (subtitle size/language,
 * autoplay, skip, hold, volume, fit/fill), the content display preferences
 * (title language, hide adult content), storage maintenance and the destructive
 * data actions — each behind a confirm dialog.
 *
 * Copy for the Android-only sections lives in the `mobileKeys` overlay
 * (`@/i18n/mobile`); the shared `settings.*` keys are reused where they exist.
 */
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { ScreenLayout } from '@/components/layout'
import { StatusBanner } from '@/components/ui/Status'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { clearAllExtensions, clearMetadataCache, resetAppSettings } from '@/lib/appSettings'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore'
import { colors, fonts, spacing, text } from '@/theme'

import { DONE_KEY } from './confirm'
import { ConfirmDialog } from './ConfirmDialog'
import { SettingsTabs } from './SettingsTabs'
import { AboutPanel } from './panels/AboutPanel'
import { AppearancePanel } from './panels/AppearancePanel'
import { DataPanel } from './panels/DataPanel'
import { ExtensionsPanel } from './panels/ExtensionsPanel'
import { LanguagePanel } from './panels/LanguagePanel'
import { PlaybackPanel } from './panels/PlaybackPanel'
import { SectionsPanel } from './panels/SectionsPanel'
import { StoragePanel } from './panels/StoragePanel'
import { DEFAULT_TAB, type SettingsTab } from './tabs'
import type { ConfirmAction } from './types'

import '@/i18n'

/** How long the "cleared" notice stays on screen. */
const NOTICE_MS = 4000

export function SettingsPage() {
  const { t } = useTranslation()
  const { status } = useConnectionStatus()

  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<SettingsTab>(DEFAULT_TAB)
  /**
   * Bumped after a reset so every panel re-reads its key instead of showing
   * the value it happened to mount with.
   */
  const [resetKey, setResetKey] = useState(0)

  /**
   * The notice is confirmation of an action, not a message that has to stay:
   * it fades on its own so the next row below it is reachable again.
   */
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    [],
  )

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }

  const clearHistory = useHistoryStore((s) => s.clear)
  const clearMyList = useFavoritesStore((s) => s.clear)
  const clearRecent = useRecentlyViewedStore((s) => s.clear)

  const runConfirm = async (action: ConfirmAction) => {
    switch (action) {
      case 'history':
        clearHistory()
        break
      case 'myList':
        clearMyList()
        break
      case 'recent':
        clearRecent()
        break
      case 'cache':
        clearMetadataCache()
        break
      case 'extensions':
        await clearAllExtensions()
        break
      case 'reset':
        resetAppSettings()
        setResetKey((key) => key + 1)
        break
    }
    showNotice(t(DONE_KEY[action]))
    setConfirm(null)
  }

  return (
    <ScreenLayout contentStyle={styles.page}>
      <View style={styles.stack}>
        <View style={styles.headerTitles}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('nav.settings')}
          </Text>
          <Text style={styles.subtitle}>{t('settings.pageDesc')}</Text>
        </View>

        {/* Connection status — shown only when there is something to report. */}
        {status !== 'running' ? <StatusBanner status={status} /> : null}

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        <SettingsTabs active={tab} onChange={setTab} />

        {/*
          One category at a time. Every panel keeps its own storage binding, so
          switching tabs is a re-render, not a reload — the controls come back
          exactly as they were left.
        */}
        {tab === 'general' ? (
          <>
            <SectionsPanel />
            <LanguagePanel />
            <AboutPanel />
          </>
        ) : null}

        {tab === 'appearance' ? <AppearancePanel resetKey={resetKey} /> : null}

        {tab === 'playback' ? <PlaybackPanel resetKey={resetKey} /> : null}

        {tab === 'extensions' ? <ExtensionsPanel resetKey={resetKey} /> : null}

        {tab === 'data' ? (
          <>
            <StoragePanel onRequest={setConfirm} />
            <DataPanel onRequest={setConfirm} />
          </>
        ) : null}
      </View>

      <ConfirmDialog
        action={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  page: { gap: 40 },
  stack: { gap: spacing.xl },

  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  notice: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
})