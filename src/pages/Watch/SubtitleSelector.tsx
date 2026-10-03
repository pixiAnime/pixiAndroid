/**
 * SubtitleSelector — tracks merged across ALL subtitle providers
 * (independent from the streaming one, spec §15/§16). Unsupported formats
 * (ASS) stay visible as metadata but can't be selected for playback.
 *
 * Port notes: the web renders `<Button>` children straight from JSX, while
 * this app's `Button` only styles *string* children — so every chip carries an
 * explicitly styled `Text` (mono-free label + muted `·format` suffix, same as
 * the web's `text-muted-foreground` span). The ASS badge's `title` tooltip has
 * no RN equivalent; it is exposed as the badge's `accessibilityLabel`.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Captions } from '@/components/icons'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { FlatSubtitle } from '@/extensions'
import { colors, fonts, spacing } from '@/theme'

/** Web: `h-6 px-2` on the ASS badge — `Badge` ships at h-5. */
const ASS_BADGE_TEXT = { height: 24, lineHeight: 22 } as const

interface SubtitleSelectorProps {
  subtitles: FlatSubtitle[]
  activeKey: string | null
  onChange: (key: string | null) => void
}

export function SubtitleSelector({ subtitles, activeKey, onChange }: SubtitleSelectorProps) {
  const { t } = useTranslation()
  if (subtitles.length === 0) return null

  const providerCount = new Set(subtitles.map((sub) => sub.providerId)).size

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
          {t('player.providers', { count: providerCount })}
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

        {subtitles.map((sub) => {
          const supported = sub.format !== 'ass'
          const selected = sub.key === activeKey

          if (!supported) {
            return (
              <View key={sub.key} accessibilityLabel={t('player.assNote')} style={styles.badgeWrap}>
                <Badge textStyle={ASS_BADGE_TEXT} variant="outline">
                  {`${sub.label ?? ''} · ${sub.format.toUpperCase()}`}
                </Badge>
              </View>
            )
          }

          return (
            <Button
              key={sub.key}
              accessibilityLabel={t('player.subsForAria', {
                label: sub.label,
                language: sub.language,
                format: sub.format,
              })}
              accessibilityState={{ selected }}
              onPress={() => onChange(sub.key)}
              size="xs"
              variant={selected ? 'secondary' : 'outline'}>
              <Text numberOfLines={1} style={styles.chipLabel}>
                {sub.label}
                {sub.format !== 'vtt' ? (
                  <Text style={styles.chipSuffix}>{` ·${sub.format}`}</Text>
                ) : null}
              </Text>
            </Button>
          )
        })}
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
  headMeta: { fontFamily: fonts.mono, fontSize: 10.4, lineHeight: 15, color: colors.mutedForeground },
  /** `flex flex-wrap gap-1.5` */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },
  /** Chip label — `Button` styles strings only, so the type is set here. */
  chipLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1, color: colors.foreground },
  /** `<span className="text-muted-foreground">·{format}</span>` */
  chipSuffix: { color: colors.mutedForeground },
  /** Wrapper that carries the web's `title` tooltip as a label. */
  badgeWrap: { opacity: 0.6, justifyContent: 'center' },
})
