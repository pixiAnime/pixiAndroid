/**
 * Extensions — installation + management screen (spec §18–§22), the port of
 * `pixiWeb/src/pages/Extensions/Extensions.tsx`, plus the Android-only
 * **repository** layer.
 *
 * Two install paths:
 *
 *  - **Provider (direct URL)** — the original flow: URL → download → evaluate
 *    in a transient sandbox → validate → preview → confirm → storage.
 *  - **Repository (manifest URL)** — enter a JSON manifest listing several
 *    provider URLs; the repo appears in a Repositories section, tapping it
 *    drills into its providers, and each provider installs through the exact
 *    same `inspectExtension` validation as the direct path.
 *
 * Copy for the repository layer lives in the `mobileKeys` overlay
 * (`@/i18n/mobile`).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Image, StyleSheet, Text, View, type TextStyle } from 'react-native'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Layers,
  Loader2,
  PackageOpen,
  Puzzle,
  RefreshCw,
  Trash2,
} from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { SafeImage } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/Badge'
import {
  Button,
  buttonForeground,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { StatusBanner } from '@/components/ui/Status'
import { Switch } from '@/components/ui/Switch'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import {
  compareVersions,
  inspectExtension,
  toStructuredExtensionError,
  useExtensionRegistry,
  type ExtensionManifest,
  type ExtensionRecord,
  type InspectedExtension,
} from '@/extensions'
import { inspectRepository, type InspectedRepository } from '@/extensions/repo/RepoLoader'
import { useRepoRegistry } from '@/extensions/repo/RepoRegistry'
import type { RepoProvider, RepoRecord } from '@/extensions/repo/types'
import { readAutoCheckUpdates } from '@/lib/appSettings'
import { localizeExtensionMessage } from '@/i18n'
import { mobileKeys } from '@/i18n/mobile'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type InspectPhase = 'idle' | 'downloading' | 'preview'
type FormMode = 'provider' | 'repo'

interface UpdateState {
  status: 'checking' | 'available' | 'current' | 'error'
  message?: string
  candidate?: InspectedExtension
}

/* ------------------------------------------------------------ button glue */

const TEXT_SIZE: Record<ButtonSize, TextStyle> = StyleSheet.create({
  default: { fontSize: 14 },
  xs: { fontSize: 12 },
  sm: { fontSize: 12 },
  lg: { fontSize: 14 },
  icon: { fontSize: 14 },
  iconSm: { fontSize: 12 },
})

const TONE_FG: Partial<Record<ButtonVariant, string>> = {
  // The destructive fill is a saturated error red; the theme's `onError`
  // (near-black) reads as muddy on it, so this page opts into white.
  destructive: '#ffffff',
}

/** Label and icon colour for a variant — both come from the button's table. */
function toneColor(variant: ButtonVariant): string {
  return TONE_FG[variant] ?? buttonForeground(variant)
}

function toneStyle(variant: ButtonVariant): TextStyle {
  return { color: toneColor(variant) }
}

interface LBtnProps extends Omit<ButtonProps, 'children'> {
  label: string
  /** Drawn in the variant's own foreground — see `ICONS` below. */
  icon?: IconFactory
}

function LBtn({ label, icon, variant = 'default', size = 'default', ...rest }: LBtnProps) {
  return (
    <Button variant={variant} size={size} {...rest}>
      {icon ? icon(toneColor(variant)) : null}
      <Text numberOfLines={1} style={[styles.btnLabel, TEXT_SIZE[size], toneStyle(variant)]}>
        {label}
      </Text>
    </Button>
  )
}

/**
 * A repository's own artwork, or the stacked-layers mark when it has none.
 *
 * The manifest's `icon` is optional and points at a remote file that may be
 * gone by the time the row is drawn, so this keeps its own failed state rather
 * than leaning on `SafeImage` — whose fallback is the striped poster
 * placeholder, which reads as "broken image" in a list of working rows.
 * Repositories added before the manifest supported an icon land here too, and
 * keep the mark they always had.
 */
function RepoAvatar({ icon, name, size = 20 }: { icon?: string; name: string; size?: number }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  return (
    <View style={styles.repoIcon}>
      {icon && !failed ? (
        <Image
          accessibilityLabel={t('common.iconAlt', { name })}
          onError={() => setFailed(true)}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri: icon }}
          style={styles.repoAvatar}
        />
      ) : (
        <Layers color={colors.mutedForeground} size={size} strokeWidth={1.6} />
      )}
    </View>
  )
}

/** The web's `<Loader2 className="animate-spin" />` — RN has no CSS spin. */
function Spin({ size = 16, color = colors.mutedForeground }: { size?: number; color?: string }) {
  const rotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 900, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [rotation])

  const spin = useMemo(
    () => ({
      transform: [
        { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
      ],
    }),
    [rotation],
  )

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={spin}>
      <Loader2 size={size} color={color} strokeWidth={1.6} />
    </Animated.View>
  )
}

/* --------------------------------------------------------------- helpers */

/**
 * Button glyphs as factories.
 *
 * `Button` draws icon children exactly as handed to it, so a pre-baked colour
 * is a trap: the icon that read fine on a filled button turns invisible the
 * moment the same glyph is put on an outline or ghost one. Taking the colour
 * as an argument lets `LBtn` paint every glyph in its variant's own
 * foreground, which is what the label next to it uses.
 */
type IconFactory = (color: string) => ReactNode

const ICONS = {
  add: (color) => <Puzzle size={16} color={color} strokeWidth={1.6} />,
  addRepo: (color) => <Layers size={16} color={color} strokeWidth={1.6} />,
  validating: (color) => <Spin size={16} color={color} />,
  install: (color) => <Download size={16} color={color} strokeWidth={1.6} />,
  confirm: (color) => <CheckCircle2 size={14} color={color} strokeWidth={1.6} />,
  details: (color) => <Info size={12} color={color} strokeWidth={1.6} />,
  checking: (color) => <Spin size={12} color={color} />,
  refresh: (color) => <RefreshCw size={12} color={color} strokeWidth={1.6} />,
  remove: (color) => <Trash2 size={12} color={color} strokeWidth={1.6} />,
  removeDestructive: (color) => <Trash2 size={16} color={color} strokeWidth={1.6} />,
  repoOpen: (color) => <ChevronRight size={16} color={color} strokeWidth={1.6} />,
  back: (color) => <ChevronLeft size={14} color={color} strokeWidth={1.6} />,
  installSmall: (color) => <Download size={14} color={color} strokeWidth={1.6} />,
} satisfies Record<string, IconFactory>

/** Not a button — the empty-state mark, so it keeps a fixed muted tint. */
const REPO_MARK = <Layers size={16} color={colors.mutedForeground} strokeWidth={1.6} />

function CapabilityBadges({ record }: { record: ExtensionRecord }) {
  const { t } = useTranslation()
  const { streaming, subtitles } = record.capabilities
  return (
    <>
      <Badge variant={streaming ? 'secondary' : 'outline'}>
        {`${t('common.streaming')} ${streaming ? '✓' : '✗'}`}
      </Badge>
      <Badge variant={subtitles ? 'secondary' : 'outline'}>
        {`${t('common.subtitles')} ${subtitles ? '✓' : '✗'}`}
      </Badge>
    </>
  )
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '—'
  }
}

function metaLine(manifest: ExtensionManifest): string {
  const { author, version, apiVersion } = manifest
  return `${author} · v${version} · api ${apiVersion ?? '1'}`
}

function providerMeta(provider: RepoProvider): string {
  const version = provider.version ? ` · v${provider.version}` : ''
  return `${provider.author}${version}`
}

/* ------------------------------------------------------------------ page */

export function ExtensionsPage() {
  const { t } = useTranslation()
  const { status } = useConnectionStatus()
  const records = useExtensionRegistry((s) => s.records)
  const hydrated = useExtensionRegistry((s) => s.hydrated)
  const upsert = useExtensionRegistry((s) => s.upsert)
  const setEnabled = useExtensionRegistry((s) => s.setEnabled)
  const remove = useExtensionRegistry((s) => s.remove)

  const repos = useRepoRegistry((s) => s.repos)
  const reposHydrated = useRepoRegistry((s) => s.hydrated)
  const addRepo = useRepoRegistry((s) => s.add)
  const removeRepo = useRepoRegistry((s) => s.remove)
  const refreshRepo = useRepoRegistry((s) => s.refresh)

  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<InspectPhase>('idle')
  const [candidate, setCandidate] = useState<InspectedExtension | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [updates, setUpdates] = useState<Record<string, UpdateState>>({})
  const [details, setDetails] = useState<ExtensionRecord | null>(null)
  const [removing, setRemoving] = useState<ExtensionRecord | null>(null)

  /* repository form + drill-down */
  const [repoUrl, setRepoUrl] = useState('')
  const [repoPhase, setRepoPhase] = useState<InspectPhase>('idle')
  const [repoCandidate, setRepoCandidate] = useState<InspectedRepository | null>(null)
  const [repoError, setRepoError] = useState<string | null>(null)
  const [openRepo, setOpenRepo] = useState<RepoRecord | null>(null)
  const [removingRepo, setRemovingRepo] = useState<RepoRecord | null>(null)
  const [refreshingRepo, setRefreshingRepo] = useState<string | null>(null)
  const [installing, setInstalling] = useState<Record<string, boolean>>({})
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    useExtensionRegistry.getState().hydrate()
    useRepoRegistry.getState().hydrate()
  }, [])

  // Auto-check: refresh repository manifests once, when the setting is on and
  // the repositories have hydrated. Guarded so it never loops on registry updates.
  const autoChecked = useRef(false)
  useEffect(() => {
    if (autoChecked.current || !reposHydrated || repos.length === 0) return
    if (!readAutoCheckUpdates()) {
      autoChecked.current = true
      return
    }
    autoChecked.current = true
    for (const repo of repos) {
      refreshRepo(repo.id).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reposHydrated, repos.length])

  const resetForm = () => {
    setFormMode(null)
    setUrl('')
    setPhase('idle')
    setCandidate(null)
    setFormError(null)
    setRepoUrl('')
    setRepoPhase('idle')
    setRepoCandidate(null)
    setRepoError(null)
  }

  /* ---------------- provider install (direct URL) ---------------- */

  const handleInspect = async () => {
    setFormError(null)
    setCandidate(null)
    setPhase('downloading')
    try {
      const inspected = await inspectExtension(url)
      setCandidate(inspected)
      setPhase('preview')
    } catch (err) {
      const structured = toStructuredExtensionError(err)
      setFormError(structured.message)
      setPhase('idle')
    }
  }

  const handleConfirm = async () => {
    if (!candidate) return
    const existing = records.find((r) => r.id === candidate.manifest.id)
    await upsert({
      id: candidate.manifest.id,
      url: candidate.url,
      manifest: candidate.manifest,
      capabilities: candidate.capabilities,
      methods: candidate.methods,
      source: candidate.source,
      enabled: true,
      installedAt: existing?.installedAt ?? Date.now(),
      updatedAt: Date.now(),
    })
    setNotice(
      existing
        ? t('extensions.reinstalledX', {
            name: candidate.manifest.name,
            version: candidate.manifest.version,
          })
        : t('extensions.installedX', {
            name: candidate.manifest.name,
            version: candidate.manifest.version,
          }),
    )
    resetForm()
  }

  /* ---------------- repository install ---------------- */

  const handleInspectRepo = async () => {
    setRepoError(null)
    setRepoCandidate(null)
    setRepoPhase('downloading')
    try {
      const inspected = await inspectRepository(repoUrl)
      setRepoCandidate(inspected)
      setRepoPhase('preview')
    } catch (err) {
      const structured = toStructuredExtensionError(err)
      setRepoError(structured.message)
      setRepoPhase('idle')
    }
  }

  const handleConfirmRepo = async () => {
    if (!repoCandidate) return
    try {
      const record = await addRepo(repoCandidate.url)
      setNotice(t(mobileKeys.repoAdded, { name: record.manifest.name }))
      resetForm()
      setOpenRepo(record)
    } catch (err) {
      setRepoError(toStructuredExtensionError(err).message)
    }
  }

  const handleRemoveRepo = async () => {
    if (!removingRepo) return
    await removeRepo(removingRepo.id)
    setNotice(t(mobileKeys.repoRemoved, { name: removingRepo.manifest.name }))
    setRemovingRepo(null)
    if (openRepo?.id === removingRepo.id) setOpenRepo(null)
  }

  const handleRefreshRepo = async (repo: RepoRecord) => {
    setRefreshingRepo(repo.id)
    try {
      await refreshRepo(repo.id)
    } catch (err) {
      setNotice(toStructuredExtensionError(err).message)
    } finally {
      setRefreshingRepo(null)
    }
  }

  const isProviderInstalled = (provider: RepoProvider): boolean =>
    records.some((r) => r.id === provider.id || r.url === provider.url)

  const installProvider = async (provider: RepoProvider) => {
    setProviderErrors((prev) => {
      const next = { ...prev }
      delete next[provider.id]
      return next
    })
    setInstalling((prev) => ({ ...prev, [provider.id]: true }))
    try {
      const inspected = await inspectExtension(provider.url)
      const existing = records.find(
        (r) => r.id === inspected.manifest.id || r.url === provider.url,
      )
      await upsert({
        id: inspected.manifest.id,
        url: inspected.url,
        manifest: inspected.manifest,
        capabilities: inspected.capabilities,
        methods: inspected.methods,
        source: inspected.source,
        enabled: true,
        installedAt: existing?.installedAt ?? Date.now(),
        updatedAt: Date.now(),
      })
      setNotice(
        existing
          ? t('extensions.updatedX', {
              name: inspected.manifest.name,
              version: inspected.manifest.version,
            })
          : t('extensions.installedX', {
              name: inspected.manifest.name,
              version: inspected.manifest.version,
            }),
      )
    } catch (err) {
      setProviderErrors((prev) => ({
        ...prev,
        [provider.id]: toStructuredExtensionError(err).message,
      }))
    } finally {
      setInstalling((prev) => {
        const next = { ...prev }
        delete next[provider.id]
        return next
      })
    }
  }

  const installAll = async (repo: RepoRecord) => {
    for (const provider of repo.manifest.providers) {
      if (isProviderInstalled(provider)) continue
      // Sequential: each install evaluates a module in the sandbox; one at a time.
      await installProvider(provider)
    }
  }

  /* ---------------- provider updates (installed list) ---------------- */

  const handleUpdateCheck = async (record: ExtensionRecord) => {
    setUpdates((prev) => ({ ...prev, [record.id]: { status: 'checking' } }))
    try {
      const candidateUpdate = await inspectExtension(record.url)
      if (candidateUpdate.manifest.id !== record.id) {
        setUpdates((prev) => ({
          ...prev,
          [record.id]: { status: 'error', message: t('extensions.updateWrongExt') },
        }))
        return
      }
      const diff = compareVersions(candidateUpdate.manifest.version, record.manifest.version)
      if (diff > 0) {
        setUpdates((prev) => ({
          ...prev,
          [record.id]: {
            status: 'available',
            message: t('extensions.updateAvailable', {
              from: record.manifest.version,
              to: candidateUpdate.manifest.version,
            }),
            candidate: candidateUpdate,
          },
        }))
      } else if (diff === 0) {
        setUpdates((prev) => ({
          ...prev,
          [record.id]: {
            status: 'current',
            message: t('extensions.updateCurrent', { version: record.manifest.version }),
          },
        }))
      } else {
        setUpdates((prev) => ({
          ...prev,
          [record.id]: { status: 'error', message: t('extensions.updateNewer') },
        }))
      }
    } catch (err) {
      const structured = toStructuredExtensionError(err, record.id)
      setUpdates((prev) => ({ ...prev, [record.id]: { status: 'error', message: structured.message } }))
    }
  }

  const applyUpdate = async (record: ExtensionRecord) => {
    const state = updates[record.id]
    if (!state?.candidate) return
    await upsert({
      ...record,
      source: state.candidate.source,
      manifest: state.candidate.manifest,
      capabilities: state.candidate.capabilities,
      methods: state.candidate.methods,
      updatedAt: Date.now(),
    })
    setNotice(
      t('extensions.updatedX', { name: record.manifest.name, version: state.candidate.manifest.version }),
    )
    setUpdates((prev) => {
      const next = { ...prev }
      delete next[record.id]
      return next
    })
  }

  const handleRemove = async () => {
    if (!removing) return
    await remove(removing.id)
    setNotice(t('extensions.removedX', { name: removing.manifest.name }))
    setRemoving(null)
  }

  /* ---------------- render ---------------- */

  const detailCaps = details
    ? [details.capabilities.streaming && 'streaming', details.capabilities.subtitles && 'subtitles']
        .filter(Boolean)
        .join(' + ') || t('common.none')
    : ''
  const detailMethods = details
    ? [details.methods.getSources && 'getSources', details.methods.getSubtitles && 'getSubtitles']
        .filter(Boolean)
        .join(', ')
    : ''

  /* Repository drill-down replaces the whole page body when a repo is open. */
  if (openRepo) {
    const repo = repos.find((r) => r.id === openRepo.id) ?? openRepo
    return (
      <ScreenLayout contentStyle={styles.page}>
        <View style={styles.drillHead}>
          <LBtn
            label={t(mobileKeys.repoBack)}
            icon={ICONS.back}
            variant="ghost"
            size="sm"
            onPress={() => setOpenRepo(null)}
          />
        </View>

        <View style={styles.repoDetailHead}>
          <RepoAvatar icon={repo.manifest.icon} name={repo.manifest.name} size={22} />
          <View style={styles.repoDetailCopy}>
            <Text accessibilityRole="header" style={styles.pageTitle}>
              {repo.manifest.name}
            </Text>
            <Text style={styles.metaMono}>
              {t(mobileKeys.repoProviders, { count: repo.manifest.providers.length })}
              {repo.manifest.author ? ` · ${repo.manifest.author}` : ''}
            </Text>
            <Text numberOfLines={2} style={styles.desc}>
              {repo.url}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <LBtn
            label={t(mobileKeys.providerInstallAll)}
            icon={ICONS.install}
            size="sm"
            onPress={() => installAll(repo)}
          />
          <LBtn
            label={refreshingRepo === repo.id ? t('common.loading') : t(mobileKeys.repoRefresh)}
            icon={refreshingRepo === repo.id ? ICONS.checking : ICONS.refresh}
            variant="outline"
            size="sm"
            disabled={refreshingRepo === repo.id}
            onPress={() => handleRefreshRepo(repo)}
          />
        </View>

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        <View style={styles.cards}>
          {repo.manifest.providers.map((provider) => {
            const installed = isProviderInstalled(provider)
            const busy = Boolean(installing[provider.id])
            const error = providerErrors[provider.id]
            return (
              <View key={provider.id} style={styles.card}>
                <SafeImage
                  src={provider.icon}
                  alt={t('common.iconAlt', { name: provider.name })}
                  aspectRatio={1}
                  style={styles.icon}
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardTitles}>
                      <Text style={styles.extTitle}>{provider.name}</Text>
                      <Text style={styles.metaMono}>{providerMeta(provider)}</Text>
                    </View>
                    {installed ? (
                      <Badge variant="secondary" textStyle={styles.installedBadge}>
                        {t(mobileKeys.providerInstalled)}
                      </Badge>
                    ) : (
                      <LBtn
                        label={busy ? t(mobileKeys.providerInstalling) : t(mobileKeys.providerInstall)}
                        icon={busy ? ICONS.validating : ICONS.installSmall}
                        size="xs"
                        disabled={busy}
                        accessibilityLabel={t(mobileKeys.providerInstallAria, { name: provider.name })}
                        onPress={() => installProvider(provider)}
                      />
                    )}
                  </View>
                  {provider.description ? (
                    <Text numberOfLines={2} style={styles.desc}>
                      {provider.description}
                    </Text>
                  ) : null}
                  {error ? (
                    <Text accessibilityRole="alert" style={styles.formError}>
                      {localizeExtensionMessage(error, t)}
                    </Text>
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout contentStyle={styles.page}>
      {/* ---------------- header ---------------- */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            {t('nav.extensions')}
          </Text>
          <Text style={styles.pageDesc}>{t('extensions.pageDesc')}</Text>
        </View>
        {!formMode ? (
          <View style={styles.headerActions}>
            <LBtn label={t('extensions.add')} icon={ICONS.add} onPress={() => setFormMode('provider')} />
            <LBtn
              label={t(mobileKeys.repoAdd)}
              icon={ICONS.addRepo}
              variant="outline"
              onPress={() => setFormMode('repo')}
            />
          </View>
        ) : null}
      </View>

      {status !== 'running' ? <StatusBanner status={status} /> : null}

      {/* ---------------- provider form ---------------- */}
      {formMode === 'provider' ? (
        <View style={styles.form}>
          <View style={styles.formHead}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {t('extensions.installFromUrl')}
            </Text>
            <LBtn label={t('common.cancel')} variant="ghost" size="xs" onPress={resetForm} />
          </View>

          <View style={styles.formFields}>
            <Input
              accessibilityLabel={t('extensions.urlLabel')}
              autoCapitalize="none"
              autoCorrect={false}
              editable={phase !== 'downloading'}
              keyboardType="url"
              mono
              onChangeText={setUrl}
              onSubmitEditing={() => handleInspect()}
              placeholder={t('extensions.urlPlaceholder')}
              returnKeyType="done"
              value={url}
            />
            <LBtn
              label={phase === 'downloading' ? t('extensions.validating') : t('extensions.install')}
              icon={phase === 'downloading' ? ICONS.validating : ICONS.install}
              disabled={phase === 'downloading' || url.trim().length === 0}
              onPress={() => handleInspect()}
            />
          </View>

          <Text style={styles.installNote}>{t('extensions.installNote')}</Text>

          {formError ? (
            <Text accessibilityRole="alert" style={styles.formError}>
              {localizeExtensionMessage(formError, t)}
            </Text>
          ) : null}

          {candidate && phase === 'preview' ? (
            <View style={styles.preview}>
              <View style={styles.previewHead}>
                <SafeImage
                  src={candidate.manifest.icon}
                  alt={t('common.iconAlt', { name: candidate.manifest.name })}
                  aspectRatio={1}
                  style={styles.icon}
                />
                <View style={styles.previewCopy}>
                  <Text style={styles.extTitle}>{candidate.manifest.name}</Text>
                  <Text style={styles.metaMono}>{metaLine(candidate.manifest)}</Text>
                  {candidate.manifest.description ? (
                    <Text style={styles.desc}>{candidate.manifest.description}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.badges}>
                <Badge variant={candidate.capabilities.streaming ? 'secondary' : 'outline'}>
                  {`${t('common.streaming')} ${candidate.capabilities.streaming ? '✓' : '✗'}`}
                </Badge>
                <Badge variant={candidate.capabilities.subtitles ? 'secondary' : 'outline'}>
                  {`${t('common.subtitles')} ${candidate.capabilities.subtitles ? '✓' : '✗'}`}
                </Badge>
              </View>

              <View style={styles.actions}>
                <LBtn label={t('extensions.confirmInstall')} size="sm" icon={ICONS.confirm} onPress={() => handleConfirm()} />
                <LBtn label={t('extensions.discard')} variant="ghost" size="sm" onPress={resetForm} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ---------------- repository form ---------------- */}
      {formMode === 'repo' ? (
        <View style={styles.form}>
          <View style={styles.formHead}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {t(mobileKeys.repoFormTitle)}
            </Text>
            <LBtn label={t('common.cancel')} variant="ghost" size="xs" onPress={resetForm} />
          </View>

          <View style={styles.formFields}>
            <Input
              accessibilityLabel={t(mobileKeys.repoUrlLabel)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={repoPhase !== 'downloading'}
              keyboardType="url"
              mono
              onChangeText={setRepoUrl}
              onSubmitEditing={() => handleInspectRepo()}
              placeholder={t(mobileKeys.repoUrlPlaceholder)}
              returnKeyType="done"
              value={repoUrl}
            />
            <LBtn
              label={repoPhase === 'downloading' ? t('extensions.validating') : t(mobileKeys.repoConfirm)}
              icon={repoPhase === 'downloading' ? ICONS.validating : ICONS.addRepo}
              disabled={repoPhase === 'downloading' || repoUrl.trim().length === 0}
              onPress={() => handleInspectRepo()}
            />
          </View>

          <Text style={styles.installNote}>{t(mobileKeys.repoFormNote)}</Text>

          {repoError ? (
            <Text accessibilityRole="alert" style={styles.formError}>
              {localizeExtensionMessage(repoError, t)}
            </Text>
          ) : null}

          {repoCandidate && repoPhase === 'preview' ? (
            <View style={styles.preview}>
              <View style={styles.previewHead}>
                <RepoAvatar
                  icon={repoCandidate.manifest.icon}
                  name={repoCandidate.manifest.name}
                  size={22}
                />
                <View style={styles.previewCopy}>
                  <Text style={styles.extTitle}>{repoCandidate.manifest.name}</Text>
                  <Text style={styles.metaMono}>
                    {t(mobileKeys.repoProviders, { count: repoCandidate.manifest.providers.length })}
                    {repoCandidate.manifest.author ? ` · ${repoCandidate.manifest.author}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.providerList}>
                {repoCandidate.manifest.providers.map((provider) => (
                  <Text key={provider.id} numberOfLines={1} style={styles.providerListLine}>
                    {`• ${provider.name}`}
                  </Text>
                ))}
              </View>

              <View style={styles.actions}>
                <LBtn label={t(mobileKeys.repoConfirm)} size="sm" icon={ICONS.confirm} onPress={() => handleConfirmRepo()} />
                <LBtn label={t('extensions.discard')} variant="ghost" size="sm" onPress={resetForm} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      {/* ---------------- repositories ---------------- */}
      <View accessibilityLabel={t(mobileKeys.repoSection)} style={styles.listSection}>
        <View style={styles.listHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t(mobileKeys.repoSection)}
          </Text>
          <Text style={styles.listCount}>
            {reposHydrated ? t(mobileKeys.repoCount, { count: repos.length }) : t('common.loading')}
          </Text>
        </View>

        {!reposHydrated ? (
          <View style={styles.loadingPanel}>
            <Spin size={16} />
            <Text style={styles.loadingLabel}>{t('common.loading')}</Text>
          </View>
        ) : repos.length === 0 ? (
          <EmptyState
            icon={REPO_MARK}
            title={t(mobileKeys.repoEmptyTitle)}
            description={t(mobileKeys.repoEmptyDesc)}
          />
        ) : (
          <View style={styles.cards}>
            {repos.map((repo) => (
              <View key={repo.id} style={styles.card}>
                <RepoAvatar icon={repo.manifest.icon} name={repo.manifest.name} />
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardTitles}>
                      <Text style={styles.extTitle}>{repo.manifest.name}</Text>
                      <Text style={styles.metaMono}>
                        {t(mobileKeys.repoProviders, { count: repo.manifest.providers.length })}
                        {repo.manifest.author ? ` · ${repo.manifest.author}` : ''}
                      </Text>
                    </View>
                    <LBtn
                      label={t(mobileKeys.repoRefresh)}
                      icon={refreshingRepo === repo.id ? ICONS.checking : ICONS.refresh}
                      variant="ghost"
                      size="xs"
                      disabled={refreshingRepo === repo.id}
                      accessibilityLabel={t(mobileKeys.repoRefreshAria, { name: repo.manifest.name })}
                      onPress={() => handleRefreshRepo(repo)}
                    />
                  </View>

                  <Text numberOfLines={1} style={styles.desc}>
                    {repo.url}
                  </Text>

                  <View style={styles.actions}>
                    <LBtn
                      label={t(mobileKeys.repoSection)}
                      icon={ICONS.repoOpen}
                      variant="ghost"
                      size="xs"
                      accessibilityLabel={t(mobileKeys.repoOpenAria, { name: repo.manifest.name })}
                      onPress={() => setOpenRepo(repo)}
                    />
                    <LBtn
                      label={t('common.remove')}
                      icon={ICONS.remove}
                      variant="ghost"
                      size="xs"
                      onPress={() => setRemovingRepo(repo)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ---------------- installed list ---------------- */}
      <View accessibilityLabel={t('extensions.installedList')} style={styles.listSection}>
        <View style={styles.listHead}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('extensions.installedList')}
          </Text>
          <Text style={styles.listCount}>
            {hydrated ? t('extensions.totalCount', { count: records.length }) : t('common.loading')}
          </Text>
        </View>

        {!hydrated ? (
          <View style={styles.loadingPanel}>
            <Spin size={16} />
            <Text style={styles.loadingLabel}>{t('extensions.loading')}</Text>
          </View>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<PackageOpen size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
            title={t('extensions.emptyTitle')}
            description={t('extensions.emptyDesc')}
          />
        ) : (
          <View style={styles.cards}>
            {records.map((record) => {
              const update = updates[record.id]
              return (
                <View key={record.id} style={styles.card}>
                  <SafeImage
                    src={record.manifest.icon}
                    alt={t('common.iconAlt', { name: record.manifest.name })}
                    aspectRatio={1}
                    style={styles.icon}
                  />
                  <View style={styles.cardBody}>
                    <View style={styles.cardHead}>
                      <View style={styles.cardTitles}>
                        <Text style={styles.extTitle}>{record.manifest.name}</Text>
                        <Text style={styles.metaMono}>{metaLine(record.manifest)}</Text>
                      </View>
                      <Switch
                        value={record.enabled}
                        accessibilityLabel={record.enabled ? t('extensions.enabled') : t('extensions.disabled')}
                        onValueChange={(next) => setEnabled(record.id, next)}
                      />
                    </View>

                    {record.manifest.description ? (
                      <Text numberOfLines={2} style={styles.desc}>
                        {record.manifest.description}
                      </Text>
                    ) : null}

                    <View style={styles.badges}>
                      <CapabilityBadges record={record} />
                      {!record.enabled ? (
                        <Badge variant="outline" textStyle={styles.badgeMuted}>
                          {t('extensions.disabledBadge')}
                        </Badge>
                      ) : null}
                    </View>

                    <View style={styles.actions}>
                      <LBtn
                        label={t('common.details')}
                        variant="ghost"
                        size="xs"
                        icon={ICONS.details}
                        accessibilityLabel={t('extensions.detailsForAria', { name: record.manifest.name })}
                        onPress={() => setDetails(record)}
                      />
                      <LBtn
                        label={t('extensions.checkUpdate')}
                        variant="ghost"
                        size="xs"
                        icon={update?.status === 'checking' ? ICONS.checking : ICONS.refresh}
                        disabled={update?.status === 'checking'}
                        onPress={() => handleUpdateCheck(record)}
                      />
                      <LBtn
                        label={t('common.remove')}
                        variant="ghost"
                        size="xs"
                        icon={ICONS.remove}
                        onPress={() => setRemoving(record)}
                      />
                    </View>

                    {update && update.status !== 'checking' ? (
                      <View style={styles.updateRow}>
                        <Text
                          accessibilityLiveRegion="polite"
                          style={update.status === 'error' ? styles.updateError : styles.updateMsg}>
                          {update.message ? localizeExtensionMessage(update.message, t) : null}
                        </Text>
                        {update.status === 'available' ? (
                          <LBtn label={t('extensions.updateNow')} size="xs" onPress={() => applyUpdate(record)} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>

      {/* ---------------- details dialog ---------------- */}
      <Dialog
        open={details !== null}
        onClose={() => setDetails(null)}
        title={details?.manifest.name ?? t('extensions.detailsTitle')}
        description={
          details
            ? `${details.manifest.author} · v${details.manifest.version} · id ${details.manifest.id}`
            : undefined
        }>
        {details ? (
          <View style={styles.dialogBody}>
            <Text style={styles.detailRow}>{`${t('extensions.rowUrl')} ${details.url}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowApi')} ${details.manifest.apiVersion ?? '1'}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowCaps')} ${detailCaps}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowMethods')} ${detailMethods}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowInstalled')} ${formatDate(details.installedAt)}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowUpdated')} ${formatDate(details.updatedAt)}`}</Text>
            <Text style={styles.detailRow}>
              {`${t('extensions.rowEnabled')} ${details.enabled ? t('common.yes') : t('common.no')}`}
            </Text>
            <Button variant="outline" style={styles.dialogAction} onPress={() => setDetails(null)}>
              {t('common.close')}
            </Button>
          </View>
        ) : null}
      </Dialog>

      {/* ---------------- remove provider confirm ---------------- */}
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t('extensions.removeTitle')}
        description={t('extensions.removeDesc', { name: removing?.manifest.name ?? '' })}>
        <LBtn label={t('common.cancel')} variant="ghost" onPress={() => setRemoving(null)} />
        <LBtn
          label={t('common.remove')}
          variant="destructive"
          icon={ICONS.removeDestructive}
          onPress={() => handleRemove()}
        />
      </Dialog>

      {/* ---------------- remove repository confirm ---------------- */}
      <Dialog
        open={removingRepo !== null}
        onClose={() => setRemovingRepo(null)}
        title={t(mobileKeys.repoRemoveTitle)}
        description={t(mobileKeys.repoRemoveDesc, { name: removingRepo?.manifest.name ?? '' })}>
        <LBtn label={t('common.cancel')} variant="ghost" onPress={() => setRemovingRepo(null)} />
        <LBtn
          label={t('common.remove')}
          variant="destructive"
          icon={ICONS.removeDestructive}
          onPress={() => handleRemoveRepo()}
        />
      </Dialog>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.xxl },

  /* header */
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: { gap: spacing.xs, flexShrink: 1 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  pageTitle: { ...text.pageHeading, color: colors.onSurface, fontSize: 20, lineHeight: 28, letterSpacing: -0.5 },
  pageDesc: { ...text.body, color: colors.mutedForeground, maxWidth: 672 },
  sectionTitle: { ...text.sectionTitle, color: colors.foreground },

  /* install form */
  form: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  formFields: { gap: spacing.sm },
  installNote: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 17, color: colors.mutedForeground },
  formError: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.destructive },
  preview: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  previewHead: { flexDirection: 'row', gap: spacing.md },
  previewCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  icon: { width: 48, flexShrink: 0, borderRadius: radii.md, overflow: 'hidden' },
  repoIcon: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    // Keeps the artwork from spilling past the rounded corners.
    overflow: 'hidden',
  },
  repoAvatar: { width: '100%', height: '100%' },
  extTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.foreground },
  metaMono: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  providerList: { gap: spacing.hair },
  providerListLine: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
  },

  /* notice + list */
  notice: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  listSection: { gap: spacing.lg },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  listCount: { ...text.monoSmall, letterSpacing: 0, textTransform: 'none' },
  loadingPanel: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingVertical: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingLabel: { fontFamily: fonts.mono, fontSize: 12, color: colors.mutedForeground },
  cards: { gap: spacing.md },

  /* card */
  card: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  cardBody: { flex: 1, minWidth: 0, gap: spacing.md },
  cardHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitles: { flexShrink: 1, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  badgeMuted: { color: colors.mutedForeground },
  installedBadge: { color: colors.statusRunning },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  updateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  updateMsg: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  updateError: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.destructive },

  /* drill-down */
  drillHead: { alignItems: 'flex-start' },
  repoDetailHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  repoDetailCopy: { flex: 1, minWidth: 0, gap: spacing.xs },

  /* dialogs */
  dialogBody: { flex: 1, gap: spacing.sm },
  detailRow: { fontFamily: fonts.mono, fontSize: 11.2, lineHeight: 16, color: colors.mutedForeground },
  dialogAction: { alignSelf: 'flex-end' },

  /* button label glue */
  btnLabel: { fontFamily: fonts.medium, letterSpacing: 0.1 },
})
