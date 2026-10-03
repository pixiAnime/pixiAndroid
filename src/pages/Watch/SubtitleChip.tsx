/**
 * One subtitle track, drawn the same way everywhere it is offered.
 *
 * Both pickers list tracks — the captions section (grouped per provider) and
 * the inline row a source provider carries — so the chip's three states live
 * here once instead of twice: selectable (label + a `·format` suffix that the
 * web shows as a muted span), selected (tonal), and ASS, which the player
 * refuses to render (`resolveSubtitleTrack`) and therefore shows only as a
 * muted badge it cannot be pressed.
 *
 * Port notes: the web renders `<Button>` children straight from JSX, while
 * this app's `Button` only styles *string* children — so every chip carries an
 * explicitly styled `Text`. The ASS badge's `title` tooltip has no RN
 * equivalent; it is exposed as the badge's `accessibilityLabel`.
 */
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { FlatSubtitle } from '@/extensions'
import { colors, fonts } from '@/theme'

/** Web: `h-6 px-2` on the ASS badge — `Badge` ships at h-5. */
const ASS_BADGE_TEXT = { height: 24, lineHeight: 22 } as const

export interface SubtitleChipProps {
  sub: FlatSubtitle
  /** Track that is on right now (null = captions off). */
  activeKey: string | null
  onChange: (key: string | null) => void
}

export function SubtitleChip({ sub, activeKey, onChange }: SubtitleChipProps) {
  const { t } = useTranslation()

  if (sub.format === 'ass') {
    return (
      <View accessibilityLabel={t('player.assNote')} style={styles.badgeWrap}>
        <Badge textStyle={ASS_BADGE_TEXT} variant="outline">
          {`${sub.label ?? ''} · ${sub.format.toUpperCase()}`}
        </Badge>
      </View>
    )
  }

  const selected = sub.key === activeKey

  return (
    <Button
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
        {sub.format !== 'vtt' ? <Text style={styles.chipSuffix}>{` ·${sub.format}`}</Text> : null}
      </Text>
    </Button>
  )
}

const styles = StyleSheet.create({
  /** Chip label — `Button` styles strings only, so the type is set here. */
  chipLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
  /** `<span className="text-muted-foreground">·{format}</span>` */
  chipSuffix: { color: colors.mutedForeground },
  /** Wrapper that carries the web's `title` tooltip as a label. */
  badgeWrap: { opacity: 0.6, justifyContent: 'center' },
})
