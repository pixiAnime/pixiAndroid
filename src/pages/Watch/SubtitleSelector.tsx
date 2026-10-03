/**
 * SubtitleSelector — tracks merged across ALL subtitle providers
 * (independent from the streaming one, spec §15/§16), now grouped by provider
 * exactly as `SourceSelector` groups sources: one tonal card per extension,
 * its name in the header, its tracks as chips inside. A flat run of chips from
 * three extensions read as one undifferentiated pile, and the group order also
 * tells the viewer which archive a track came from — which is the whole point
 * of `providerName` being stamped on every track.
 *
 * The **off** chip stays outside the groups: it is not a provider's track but
 * the absence of any, and putting it inside one would read as "that provider
 * is the one that is off".
 *
 * Unsupported formats (ASS) stay visible as metadata but can't be selected for
 * playback — see `./SubtitleChip`.
 */
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Captions } from '@/components/icons'

import { Button } from '@/components/ui/Button'
import type { FlatSubtitle } from '@/extensions'
import { colors, fonts, radii, spacing } from '@/theme'
import { SubtitleChip } from './SubtitleChip'
import { groupSubtitlesByProvider } from './subtitleGroups'

interface SubtitleSelectorProps {
  subtitles: FlatSubtitle[]
  activeKey: string | null
  onChange: (key: string | null) => void
}

export function SubtitleSelector({ subtitles, activeKey, onChange }: SubtitleSelectorProps) {
  const { t } = useTranslation()
  const groups = useMemo(() => groupSubtitlesByProvider(subtitles), [subtitles])

  if (subtitles.length === 0) return null

  return (
    <View accessibilityLabel={t('common.subtitles')} style={styles.section}>
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <Captions size={12} color={colors.mutedForeground} strokeWidth={1.6} />
          <Text style={styles.heading}>{t('common.subtitles')}</Text>
        </View>
        <Text style={styles.headMeta}>
          {t('player.tracks', { count: subtitles.length })}
          {' · '}
          {t('player.providers', { count: groups.length })}
        </Text>
      </View>

      <View style={styles.chips}>
        <Button
          accessibilityLabel={t('player.subsOffAria')}
          accessibilityState={{ selected: activeKey === null }}
          onPress={() => onChange(null)}
          size="xs"
          variant={activeKey === null ? 'secondary' : 'outline'}>
          {t('player.off')}
        </Button>
      </View>

      <View style={styles.groups}>
        {groups.map((group) => (
          <View key={group.providerId} style={styles.group}>
            <View style={styles.groupHead}>
              <Captions size={12} color={colors.mutedForeground} strokeWidth={1.6} />
              <Text style={styles.groupName}>{group.providerName}</Text>
            </View>

            <View style={styles.chips}>
              {group.items.map((sub) => (
                <SubtitleChip
                  key={sub.key}
                  activeKey={activeKey}
                  onChange={onChange}
                  sub={sub}
                />
              ))}
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  /** `font-mono text-[0.65rem] tracking-wide uppercase text-muted-foreground` */
  heading: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `font-mono text-[0.65rem] text-muted-foreground` — sentence case, not upper. */
  headMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  groups: { gap: spacing.sm },
  /** Subtitle-provider group surface — same skin as a source group. */
  group: { borderRadius: radii.lg, backgroundColor: colors.surfaceContainer, padding: spacing.md },
  /** `mb-2` + inline icon */
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  groupName: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.mutedForeground },
  /** `flex flex-wrap gap-1.5` */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
})
