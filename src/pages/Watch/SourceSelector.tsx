/**
 * SourceSelector — all sources from all streaming extensions, grouped by
 * provider (spec §29). Ordering is deterministic metadata only (quality →
 * format → provider name) — no subjective ranking.
 *
 * A group that *also* carries captions (Ayruki streams and subtitles in one
 * call, `demo-both` by design) gets a disclosure row underneath its chips:
 * collapsed by default, because the source is what the viewer came here to
 * pick — the captions next to it are context, not a second decision. Expanding
 * it lists that provider's tracks with the very chip the captions section
 * uses (`./SubtitleChip`), so the two lists cannot disagree about what is
 * selected.
 *
 * Port notes: `<Button aria-pressed>` becomes `accessibilityState.selected`
 * (RN has no pressed role) and the disclosure reports
 * `accessibilityState.expanded`; the provider glyph sits in its own row
 * because an RN `Text` cannot host an inline icon the way `<svg
 * className="inline">` does.
 */
import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Captions, ChevronDown, Layers } from '@/components/icons'

import { Button } from '@/components/ui/Button'
import type { FlatSource, FlatSubtitle } from '@/extensions'
import { colors, fonts, radii, spacing } from '@/theme'
import { SubtitleChip } from './SubtitleChip'
import { indexSubtitlesByProvider } from './subtitleGroups'

interface SourceSelectorProps {
  sources: FlatSource[]
  selectedKey: string | null
  onSelect: (key: string) => void
  /**
   * The page's merged captions, so a provider present in both lists can show
   * its own tracks right here. Providers with no captions simply get no row.
   */
  subtitles: FlatSubtitle[]
  activeSubtitleKey: string | null
  onSubtitleSelect: (key: string | null) => void
}

interface ProviderGroup {
  providerId: string
  providerName: string
  items: FlatSource[]
}

export function SourceSelector({
  sources,
  selectedKey,
  onSelect,
  subtitles,
  activeSubtitleKey,
  onSubtitleSelect,
}: SourceSelectorProps) {
  const { t } = useTranslation()

  const groups = useMemo(() => {
    const map = new Map<string, ProviderGroup>()
    for (const source of sources) {
      let group = map.get(source.providerId)
      if (!group) {
        group = { providerId: source.providerId, providerName: source.providerName, items: [] }
        map.set(source.providerId, group)
      }
      group.items.push(source)
    }
    return [...map.values()]
  }, [sources])

  const captionsByProvider = useMemo(() => indexSubtitlesByProvider(subtitles), [subtitles])

  /** Providers whose caption row is open — every row starts collapsed. */
  const [openCaptions, setOpenCaptions] = useState<ReadonlySet<string>>(() => new Set())

  const toggleCaptions = useCallback((providerId: string) => {
    setOpenCaptions((prev) => {
      const next = new Set(prev)
      if (next.has(providerId)) next.delete(providerId)
      else next.add(providerId)
      return next
    })
  }, [])

  if (sources.length === 0) return null

  return (
    <View accessibilityLabel={t('player.sourcesAria')} style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.heading}>{t('player.source')}</Text>
        <Text style={styles.headMeta}>
          {t('player.available', { count: sources.length })}
          {' · '}
          {t('player.providers', { count: groups.length })}
        </Text>
      </View>

      <View style={styles.groups}>
        {groups.map((group) => {
          const groupCaptions = captionsByProvider.get(group.providerId) ?? []
          const expanded = openCaptions.has(group.providerId)

          return (
            <View key={group.providerId} style={styles.group}>
              <View style={styles.groupHead}>
                <Layers size={12} color={colors.mutedForeground} strokeWidth={1.6} />
                <Text style={styles.groupName}>{group.providerName}</Text>
              </View>

              <View style={styles.chips}>
                {group.items.map((source) => {
                  const selected = source.key === selectedKey
                  const labelParts = [
                    source.quality ?? null,
                    source.type,
                    source.language ?? null,
                  ].filter(Boolean)
                  return (
                    <Button
                      key={source.key}
                      accessibilityLabel={t('player.sourceVia', {
                        parts: labelParts.join(' '),
                        provider: source.providerName,
                      })}
                      accessibilityState={{ selected }}
                      onPress={() => onSelect(source.key)}
                      size="xs"
                      variant={selected ? 'secondary' : 'outline'}>
                      {labelParts.join(' · ')}
                    </Button>
                  )
                })}
              </View>

              {groupCaptions.length > 0 ? (
                <View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => toggleCaptions(group.providerId)}
                    style={({ pressed }) => [styles.disclosure, pressed && styles.disclosurePressed]}>
                    <Captions size={12} color={colors.mutedForeground} strokeWidth={1.6} />
                    <Text style={styles.disclosureLabel}>{t('common.subtitles')}</Text>
                    <Text style={styles.disclosureMeta}>
                      {t('player.tracks', { count: groupCaptions.length })}
                    </Text>
                    <View
                      style={[
                        styles.disclosureChevron,
                        { transform: [{ rotate: expanded ? '0deg' : '-90deg' }] },
                      ]}>
                      <ChevronDown size={14} color={colors.mutedForeground} strokeWidth={1.6} />
                    </View>
                  </Pressable>

                  {expanded ? (
                    <View style={styles.captionChips}>
                      {groupCaptions.map((sub) => (
                        <SubtitleChip
                          key={sub.key}
                          activeKey={activeSubtitleKey}
                          onChange={onSubtitleSelect}
                          sub={sub}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  /** `space-y-2` */
  section: { gap: spacing.sm },
  /** `flex items-center justify-between` */
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /** `font-mono text-[0.65rem] tracking-wide uppercase text-muted-foreground` */
  heading: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `font-mono text-[0.65rem] text-muted-foreground` — sentence case, not upper. */
  headMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  groups: { gap: spacing.sm },
  /** Source-provider group surface. */
  group: { borderRadius: radii.lg, backgroundColor: colors.surfaceContainer, padding: spacing.md },
  /** `mb-2` + inline icon */
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  groupName: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `flex flex-wrap gap-1.5` */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  /** Caption disclosure — a rule above it, since it sits last in the card. */
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopColor: colors.outlineVariant,
    borderTopWidth: 1,
    paddingVertical: spacing.xs,
  },
  disclosurePressed: { opacity: 0.7 },
  disclosureLabel: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  disclosureMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  /** `-90deg` when collapsed, applied inline as the state changes. */
  disclosureChevron: { marginLeft: 'auto' },
  /** Expanded tracks — same rhythm as the card's own chips. */
  captionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5, marginTop: spacing.xs },
})
