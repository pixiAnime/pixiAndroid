/**
 * Settings — the app's full preferences hub.
 *
 * Beyond the sections that left the nav (History, My List, Extensions), the
 * language picker and the About panel, this now surfaces the playback defaults
 * the player used to bury in its own gear menu (subtitle size/language,
 * autoplay, skip, hold, volume, fit/fill), the content display preferences
 * (title language, hide adult content), storage maintenance and the destructive
 * data actions — each behind a confirm dialog.
 *
 * Copy for the Android-only sections lives in the `mobileKeys` overlay
 * (`@/i18n/mobile`); the shared `settings.*` keys are reused where they exist.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ChevronRight, History, List, Puzzle } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { ScreenLayout } from '@/components/layout'
import { Separator } from '@/components/ui/Primitives'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { StatusBanner } from '@/components/ui/Status'
import { Switch } from '@/components/ui/Switch'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { LANGUAGES, setLanguage } from '@/i18n'
import { mobileKeys } from '@/i18n/mobile'
import type { RootStackParamList } from '@/navigation/types'
import { colors, fonts, radii, spacing, text } from '@/theme'

import {
  clearAllExtensions,
  clearMetadataCache,
  readAutoCheckUpdates,
  resetAppSettings,
  writeAutoCheckUpdates,
} from '@/lib/appSettings'
import {
  readHideAdult,
  readTitleLanguage,
  TITLE_LANGUAGES,
  writeHideAdult,
  writeTitleLanguage,
  type TitleLanguage,
} from '@/lib/contentPreferences'
import { useExtensionRegistry } from '@/extensions/runtime/ExtensionRegistry'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore'

import {
  BOOST_CHOICES,
  SKIP_CHOICES,
} from '../Watch/tapGestures'
import {
  readAutoNext,
  readHoldRate,
  readFillMode,
  readSkipSeconds,
  readSubtitleLanguage,
  readSubtitleSize,
  readVolume,
  SUBTITLE_LANGUAGE_CHOICES,
  SUBTITLE_SIZE_CYCLE,
  writeAutoNext,
  writeFillMode,
  writeHoldRate,
  writeSkipSeconds,
  writeSubtitleLanguage,
  writeSubtitleSize,
  writeVolume,
  type SubtitleLanguagePref,
} from '../Watch/playerPrefs'
import type { SubtitleSize } from '../Watch/subtitleScale'
import { ActionRow, Panel, SettingChoice, SettingRow } from './components'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface Section {
  route: 'History' | 'MyList' | 'Extensions'
  labelKey: string
  descKey: string
  icon: typeof History
}

const SECTIONS: Section[] = [
  { route: 'History', labelKey: 'nav.history', descKey: 'settings.sectionHistoryDesc', icon: History },
  { route: 'MyList', labelKey: 'nav.myList', descKey: 'settings.sectionMyListDesc', icon: List },
  { route: 'Extensions', labelKey: 'nav.extensions', descKey: 'settings.sectionExtensionsDesc', icon: Puzzle },
]

/** Terms/values are i18n keys. The web's `Playback` row is bridge-only → omitted. */
const ABOUT: Array<{ termKey: string; valueKey: string }> = [
  { termKey: 'settings.aboutData', valueKey: 'settings.aboutDataValue' },
  { termKey: 'settings.aboutStorage', valueKey: 'settings.aboutStorageValue' },
  { termKey: 'settings.aboutPrivacy', valueKey: 'settings.aboutPrivacyValue' },
]

const VOLUME_CHOICES = [0.25, 0.5, 0.75, 1] as const

type ConfirmKind = 'history' | 'myList' | 'recent' | 'cache' | 'extensions' | 'reset' | null

const CONFIRM_DESC: Record<Exclude<ConfirmKind, null>, string> = {
  history: mobileKeys.confirmClearHistory,
  myList: mobileKeys.confirmClearMyList,
  recent: mobileKeys.confirmClearRecent,
  cache: mobileKeys.confirmClearCache,
  extensions: mobileKeys.confirmClearExtensions,
  reset: mobileKeys.confirmReset,
}

const DONE_KEY: Record<Exclude<ConfirmKind, null>, string> = {
  history: mobileKeys.historyCleared,
  myList: mobileKeys.myListCleared,
  recent: mobileKeys.recentCleared,
  cache: mobileKeys.cacheCleared,
  extensions: mobileKeys.extensionsCleared,
  reset: mobileKeys.settingsReset,
}

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { status } = useConnectionStatus()
  const navigation = useNavigation<Nav>()
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]

  /* ---------------- playback preferences ---------------- */
  const [autoNext, setAutoNext] = useState(() => readAutoNext())
  const [skipSeconds, setSkipSeconds] = useState(() => readSkipSeconds())
  const [holdRate, setHoldRate] = useState(() => readHoldRate())
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSize>(() => readSubtitleSize('medium'))
  const [subtitleLanguage, setSubtitleLanguage] = useState<SubtitleLanguagePref>(() =>
    readSubtitleLanguage(),
  )
  const [volume, setVolume] = useState(() => readVolume())
  const [fillMode, setFillMode] = useState(() => readFillMode())

  /* ---------------- content + extension preferences ---------------- */
  const [titleLanguage, setTitleLanguage] = useState<TitleLanguage>(() => readTitleLanguage())
  const [hideAdult, setHideAdult] = useState(() => readHideAdult())
  const [autoCheck, setAutoCheck] = useState(() => readAutoCheckUpdates())

  /* ---------------- destructive actions ---------------- */
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const clearHistory = useHistoryStore((s) => s.clear)
  const clearMyList = useFavoritesStore((s) => s.clear)
  const clearRecent = useRecentlyViewedStore((s) => s.clear)

  const runConfirm = async () => {
    const kind = confirm
    if (!kind) return
    switch (kind) {
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
        // Re-apply defaults into local state so the controls reflect the reset.
        setAutoNext(readAutoNext())
        setSkipSeconds(readSkipSeconds())
        setHoldRate(readHoldRate())
        setSubtitleSize(readSubtitleSize('medium'))
        setSubtitleLanguage(readSubtitleLanguage())
        setVolume(readVolume())
        setFillMode(readFillMode())
        setTitleLanguage(readTitleLanguage())
        setHideAdult(readHideAdult())
        setAutoCheck(readAutoCheckUpdates())
        break
    }
    setNotice(t(DONE_KEY[kind]))
    setConfirm(null)
  }

  const extensionCount = useExtensionRegistry((s) => s.records.length)

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

        {/* Sections */}
        <View accessibilityLabel={t('settings.sectionsAria')} style={styles.sections}>
          {SECTIONS.map((section) => (
            <Pressable
              key={section.route}
              accessibilityRole="link"
              style={({ pressed }) => [styles.sectionCard, pressed && styles.sectionCardPressed]}
              onPress={() => navigation.navigate(section.route)}>
              <View style={styles.sectionIcon}>
                <section.icon size={20} color={colors.mutedForeground} strokeWidth={1.6} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionLabel}>{t(section.labelKey)}</Text>
                <Text style={styles.sectionDesc}>{t(section.descKey)}</Text>
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} strokeWidth={1.6} />
            </Pressable>
          ))}
        </View>

        {/* Language */}
        <Panel label={t('settings.languageHeading')} ariaLabel={t('settings.languageAria')}>
          <View style={styles.panelBody}>
            <View style={styles.languageRow}>
              {LANGUAGES.map((lang) => (
                <Button
                  key={lang.code}
                  size="xs"
                  variant={current === lang.code ? 'secondary' : 'outline'}
                  accessibilityState={{ selected: current === lang.code }}
                  onPress={() => setLanguage(lang.code)}>
                  {lang.label}
                </Button>
              ))}
            </View>
            <Text style={styles.panelNote}>{t('settings.languageDesc')}</Text>
          </View>
        </Panel>

        {/* Playback */}
        <Panel label={t(mobileKeys.playbackHeading)} ariaLabel={t(mobileKeys.playbackAria)}>
          <SettingRow
            first
            title={t(mobileKeys.autoplayNext)}
            description={t(mobileKeys.autoplayNextDesc)}>
            <Switch
              value={autoNext}
              accessibilityLabel={t(mobileKeys.autoplayNext)}
              onValueChange={(next) => {
                setAutoNext(next)
                writeAutoNext(next)
              }}
            />
          </SettingRow>

          <SettingChoice
            title={t(mobileKeys.skipInterval)}
            description={t(mobileKeys.skipIntervalDesc)}
            value={skipSeconds}
            options={SKIP_CHOICES}
            format={(value) => `${value}s`}
            onChange={(value) => {
              setSkipSeconds(value)
              writeSkipSeconds(value)
            }}
          />

          <SettingChoice
            title={t(mobileKeys.holdSpeed)}
            description={t(mobileKeys.holdSpeedDesc)}
            value={holdRate}
            options={BOOST_CHOICES}
            format={(value) => `${value}×`}
            onChange={(value) => {
              setHoldRate(value)
              writeHoldRate(value)
            }}
          />

          <SettingChoice
            title={t(mobileKeys.subtitleSize)}
            description={t(mobileKeys.subtitleSizeDesc)}
            value={subtitleSize}
            options={SUBTITLE_SIZE_CYCLE}
            onChange={(value) => {
              setSubtitleSize(value)
              writeSubtitleSize(value)
            }}
          />

          <SettingChoice
            title={t(mobileKeys.subtitleLanguage)}
            description={t(mobileKeys.subtitleLanguageDesc)}
            value={subtitleLanguage}
            options={SUBTITLE_LANGUAGE_CHOICES}
            format={(value) =>
              value === 'auto' ? t(mobileKeys.subtitleAuto) : value.toUpperCase()
            }
            onChange={(value) => {
              setSubtitleLanguage(value)
              writeSubtitleLanguage(value)
            }}
          />

          <SettingChoice
            title={t(mobileKeys.defaultVolume)}
            description={t(mobileKeys.defaultVolumeDesc)}
            value={volume}
            options={VOLUME_CHOICES}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => {
              setVolume(value)
              writeVolume(value)
            }}
          />

          <SettingRow title={t(mobileKeys.fillToggle)} description={t(mobileKeys.fillToggleDesc)}>
            <Switch
              value={fillMode}
              accessibilityLabel={t(mobileKeys.fillToggle)}
              onValueChange={(next) => {
                setFillMode(next)
                writeFillMode(next)
              }}
            />
          </SettingRow>
        </Panel>

        {/* Content */}
        <Panel label={t(mobileKeys.contentHeading)} ariaLabel={t(mobileKeys.contentAria)}>
          <SettingChoice
            first
            title={t(mobileKeys.titleLanguage)}
            description={t(mobileKeys.titleLanguageDesc)}
            value={titleLanguage}
            options={TITLE_LANGUAGES}
            format={(value) =>
              value === 'en'
                ? t(mobileKeys.titleEn)
                : value === 'romaji'
                  ? t(mobileKeys.titleRomaji)
                  : t(mobileKeys.titleNative)
            }
            onChange={(value) => {
              setTitleLanguage(value)
              writeTitleLanguage(value)
            }}
          />
          <SettingRow title={t(mobileKeys.hideAdult)} description={t(mobileKeys.hideAdultDesc)}>
            <Switch
              value={hideAdult}
              accessibilityLabel={t(mobileKeys.hideAdult)}
              onValueChange={(next) => {
                setHideAdult(next)
                writeHideAdult(next)
              }}
            />
          </SettingRow>
        </Panel>

        {/* Extensions */}
        <Panel label={t(mobileKeys.extensionsHeading)} ariaLabel={t(mobileKeys.extensionsAria)}>
          <SettingRow
            first
            title={t(mobileKeys.autoCheckUpdates)}
            description={t(mobileKeys.autoCheckUpdatesDesc)}>
            <Switch
              value={autoCheck}
              accessibilityLabel={t(mobileKeys.autoCheckUpdates)}
              onValueChange={(next) => {
                setAutoCheck(next)
                writeAutoCheckUpdates(next)
              }}
            />
          </SettingRow>
          <ActionRow
            title={t(mobileKeys.manageRepos)}
            description={t('settings.sectionExtensionsDesc')}
            actionLabel={t('nav.extensions')}
            onPress={() => navigation.navigate('Extensions')}
          />
        </Panel>

        {/* Storage */}
        <Panel label={t(mobileKeys.storageHeading)} ariaLabel={t(mobileKeys.storageAria)}>
          <ActionRow
            first
            title={t(mobileKeys.clearCache)}
            description={t(mobileKeys.clearCacheDesc)}
            actionLabel={t(mobileKeys.clearCache)}
            onPress={() => setConfirm('cache')}
          />
          <ActionRow
            title={t(mobileKeys.clearExtensionsData)}
            description={t(mobileKeys.clearExtensionsDataDesc)}
            actionLabel={t(mobileKeys.clearExtensionsData)}
            destructive
            disabled={extensionCount === 0}
            onPress={() => setConfirm('extensions')}
          />
        </Panel>

        {/* Data & privacy */}
        <Panel label={t(mobileKeys.dataHeading)} ariaLabel={t(mobileKeys.dataAria)}>
          <ActionRow
            first
            title={t(mobileKeys.clearHistory)}
            description={t(mobileKeys.clearHistoryDesc)}
            actionLabel={t('common.remove')}
            destructive
            onPress={() => setConfirm('history')}
          />
          <ActionRow
            title={t(mobileKeys.clearMyList)}
            description={t(mobileKeys.clearMyListDesc)}
            actionLabel={t('common.remove')}
            destructive
            onPress={() => setConfirm('myList')}
          />
          <ActionRow
            title={t(mobileKeys.clearRecent)}
            description={t(mobileKeys.clearRecentDesc)}
            actionLabel={t('common.remove')}
            destructive
            onPress={() => setConfirm('recent')}
          />
          <ActionRow
            title={t(mobileKeys.resetSettings)}
            description={t(mobileKeys.resetSettingsDesc)}
            actionLabel={t(mobileKeys.resetSettings)}
            destructive
            onPress={() => setConfirm('reset')}
          />
        </Panel>

        {/* About */}
        <Panel label={t('settings.aboutHeading')} ariaLabel={t('settings.aboutAria')}>
          {ABOUT.map((row, index) => (
            <View key={row.termKey}>
              {index > 0 ? <Separator /> : null}
              <View style={styles.aboutRow}>
                <Text style={styles.aboutTerm}>{t(row.termKey)}</Text>
                <Text style={styles.aboutValue}>{t(row.valueKey)}</Text>
              </View>
            </View>
          ))}
        </Panel>

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </View>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t(mobileKeys.confirmTitle)}
        description={confirm ? t(CONFIRM_DESC[confirm]) : undefined}>
        <Button variant="ghost" onPress={() => setConfirm(null)}>
          {t('common.cancel')}
        </Button>
        <Button variant="destructive" onPress={() => runConfirm()}>
          {t('common.yes')}
        </Button>
      </Dialog>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  page: { gap: 40 },
  stack: { gap: spacing.xl },

  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  sections: { gap: spacing.lg },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
  },
  sectionCardPressed: { opacity: 0.9 },
  sectionIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.onSurface },
  sectionDesc: { ...text.meta },

  panelBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  panelNote: { ...text.meta },

  aboutRow: {
    flexDirection: 'column',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  aboutTerm: { ...text.monoSmall },
  aboutValue: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.foreground },

  notice: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, color: colors.onSurfaceVariant },
})
