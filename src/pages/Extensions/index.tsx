/**
 * Extensions — installation + management screen (spec §18–§22), the port of
 * `pixiWeb/src/pages/Extensions/Extensions.tsx`.
 *
 * Install flow: URL → download → evaluate in a transient sandbox → validate
 * manifest + API version → preview → user confirms → storage. Nothing
 * executes before validation, and the states (idle / downloading /
 * preview / error), the copy and the a11y labels are byte-for-byte the web's
 * i18n keys.
 *
 * What changed for native: the web downloads through the pixiClient bridge
 * and opens the offline dialog when the bridge is down. Android has neither
 * (native `fetch`, native sandbox), so `inspectExtension` is called directly
 * and the bridge-only offline banner has no counterpart here.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, StyleSheet, Text, View, type TextStyle } from 'react-native'
import {
  CheckCircle2,
  Download,
  Info,
  Loader2,
  PackageOpen,
  Puzzle,
  RefreshCw,
  Trash2,
} from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { SafeImage } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/Badge'
import { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from '@/components/ui/Button'
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
import { localizeExtensionMessage } from '@/i18n'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type InspectPhase = 'idle' | 'downloading' | 'preview'

interface UpdateState {
  status: 'checking' | 'available' | 'current' | 'error'
  message?: string
  candidate?: InspectedExtension
}

/* ------------------------------------------------------------ button glue */

/**
 * `Button` styles its plain-string children itself; anything that carries an
 * icon has to reproduce the same face, size and colour by hand — on the web
 * `text-sm font-medium` + `[&_svg:not([class*='size-'])]:size-4` do it in CSS.
 * The tables below mirror `Button`'s own size/variant metrics exactly.
 */
const TEXT_SIZE: Record<ButtonSize, TextStyle> = StyleSheet.create({
  default: { fontSize: 14 },
  xs: { fontSize: 12 },
  sm: { fontSize: 12 },
  lg: { fontSize: 14 },
  icon: { fontSize: 14 },
  iconSm: { fontSize: 12 },
})

const TONE_FG: Record<ButtonVariant, string> = {
  default: colors.primaryForeground,
  outline: colors.foreground,
  secondary: colors.secondaryForeground,
  ghost: colors.foreground,
  destructive: '#ffffff',
  link: colors.foreground,
}

/** The same tone as a text style — RN widens `color`, icons want a `string`. */
function toneStyle(variant: ButtonVariant): TextStyle {
  return { color: TONE_FG[variant] }
}

interface LBtnProps extends Omit<ButtonProps, 'children'> {
  label: string
  /** Pre-built node from `ICONS` — colour already matches the variant's tone. */
  icon?: ReactNode
}

function LBtn({ label, icon, variant = 'default', size = 'default', ...rest }: LBtnProps) {
  return (
    <Button variant={variant} size={size} {...rest}>
      {icon}
      <Text numberOfLines={1} style={[styles.btnLabel, TEXT_SIZE[size], toneStyle(variant)]}>
        {label}
      </Text>
    </Button>
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
 * Button icons, pre-sized like the web's `[&_svg]:size-4` / `size-3` /
 * `size-3.5` and coloured with the `TONE_FG` of the variant they ride on
 * (the web lets `currentColor` do that).
 */
const ICONS = {
  add: <Puzzle size={16} color={colors.primaryForeground} strokeWidth={1.6} />,
  validating: <Spin size={16} color={colors.primaryForeground} />,
  install: <Download size={16} color={colors.primaryForeground} strokeWidth={1.6} />,
  confirm: <CheckCircle2 size={14} color={colors.primaryForeground} strokeWidth={1.6} />,
  details: <Info size={12} color={colors.foreground} strokeWidth={1.6} />,
  checking: <Spin size={12} color={colors.foreground} />,
  refresh: <RefreshCw size={12} color={colors.foreground} strokeWidth={1.6} />,
  remove: <Trash2 size={12} color={colors.foreground} strokeWidth={1.6} />,
  removeDestructive: <Trash2 size={16} color="#ffffff" strokeWidth={1.6} />,
}

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

/* ------------------------------------------------------------------ page */

export function ExtensionsPage() {
  const { t } = useTranslation()
  const { status } = useConnectionStatus()
  const records = useExtensionRegistry((s) => s.records)
  const hydrated = useExtensionRegistry((s) => s.hydrated)
  const upsert = useExtensionRegistry((s) => s.upsert)
  const setEnabled = useExtensionRegistry((s) => s.setEnabled)
  const remove = useExtensionRegistry((s) => s.remove)

  const [formOpen, setFormOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<InspectPhase>('idle')
  const [candidate, setCandidate] = useState<InspectedExtension | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [updates, setUpdates] = useState<Record<string, UpdateState>>({})
  const [details, setDetails] = useState<ExtensionRecord | null>(null)
  const [removing, setRemoving] = useState<ExtensionRecord | null>(null)

  useEffect(() => {
    useExtensionRegistry.getState().hydrate()
  }, [])

  const resetForm = () => {
    setFormOpen(false)
    setUrl('')
    setPhase('idle')
    setCandidate(null)
    setFormError(null)
  }

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
          [record.id]: {
            status: 'error',
            message: t('extensions.updateNewer'),
          },
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
        {!formOpen ? (
          <LBtn
            label={t('extensions.add')}
            icon={ICONS.add}
            onPress={() => setFormOpen(true)}
          />
        ) : null}
      </View>

      {/* Connection status — the washed-out states explain why installs/playback may stall. */}
      {status !== 'running' ? <StatusBanner status={status} /> : null}

      {/* ---------------- install form ---------------- */}
      {formOpen ? (
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
                <LBtn
                  label={t('extensions.confirmInstall')}
                  size="sm"
                  icon={ICONS.confirm}
                  onPress={() => handleConfirm()}
                />
                <LBtn
                  label={t('extensions.discard')}
                  variant="ghost"
                  size="sm"
                  onPress={resetForm}
                />
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
                        accessibilityLabel={
                          record.enabled ? t('extensions.enabled') : t('extensions.disabled')
                        }
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
                        accessibilityLabel={t('extensions.detailsForAria', {
                          name: record.manifest.name,
                        })}
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
                          <LBtn
                            label={t('extensions.updateNow')}
                            size="xs"
                            onPress={() => applyUpdate(record)}
                          />
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
            <Text style={styles.detailRow}>
              {`${t('extensions.rowApi')} ${details.manifest.apiVersion ?? '1'}`}
            </Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowCaps')} ${detailCaps}`}</Text>
            <Text style={styles.detailRow}>{`${t('extensions.rowMethods')} ${detailMethods}`}</Text>
            <Text style={styles.detailRow}>
              {`${t('extensions.rowInstalled')} ${formatDate(details.installedAt)}`}
            </Text>
            <Text style={styles.detailRow}>
              {`${t('extensions.rowUpdated')} ${formatDate(details.updatedAt)}`}
            </Text>
            <Text style={styles.detailRow}>
              {`${t('extensions.rowEnabled')} ${details.enabled ? t('common.yes') : t('common.no')}`}
            </Text>
            <Button variant="outline" style={styles.dialogAction} onPress={() => setDetails(null)}>
              {t('common.close')}
            </Button>
          </View>
        ) : null}
      </Dialog>

      {/* ---------------- remove confirm ---------------- */}
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
  installNote: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
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
  extTitle: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.foreground },
  metaMono: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },

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

  /* extension card */
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeMuted: { color: colors.mutedForeground },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
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

  /* dialogs */
  dialogBody: { flex: 1, gap: spacing.sm },
  detailRow: { fontFamily: fonts.mono, fontSize: 11.2, lineHeight: 16, color: colors.mutedForeground },
  dialogAction: { alignSelf: 'flex-end' },

  /* button label glue */
  btnLabel: { fontFamily: fonts.medium, letterSpacing: 0.1 },
})
