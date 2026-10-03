/**
 * SourceSelector — all sources from all streaming extensions, grouped by
 * provider (spec §29). Ordering is deterministic metadata only (quality →
 * format → provider name) — no subjective ranking.
 *
 * Port notes: `<Button aria-pressed>` becomes `accessibilityState.selected`
 * (RN has no pressed role), and the provider glyph sits in its own row because
 * an RN `Text` cannot host an inline icon the way `<svg className="inline">`
 * does.
 */
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import type { FlatSource } from '@/extensions'
import { colors, fonts, spacing } from '@/theme'

interface SourceSelectorProps {
  sources: FlatSource[]
  selectedKey: string | null
  onSelect: (key: string) => void
}

interface ProviderGroup {
  providerId: string
  providerName: string
  items: FlatSource[]
}

export function SourceSelector({ sources, selectedKey, onSelect }: SourceSelectorProps) {
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
        {groups.map((group) => (
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
          </View>
        ))}
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
  /** `border border-border bg-card p-3` */
  group: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.md },
  /** `mb-2` + inline icon */
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  groupName: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `flex flex-wrap gap-1.5` */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
})
