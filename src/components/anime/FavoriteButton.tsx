/**
 * FavoriteButton — add/remove from My List (local store).
 */
import { StyleSheet, Text } from 'react-native'
import { Heart } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { useFavoritesStore, selectIsFavorite } from '@/stores/favoritesStore'
import { colors, fonts } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

interface FavoriteButtonProps {
  animeId: number
  title: string
  titleEnglish?: string | null
  posterUrl?: string | null
  score?: number | null
  size?: 'sm' | 'default' | 'lg'
  variant?: 'outline' | 'ghost' | 'secondary'
}

export function FavoriteButton({
  animeId,
  title,
  titleEnglish,
  posterUrl,
  score,
  size = 'default',
  variant = 'outline',
}: FavoriteButtonProps) {
  const { t } = useTranslation()
  const favorites = useFavoritesStore((s) => s.favorites)
  const toggle = useFavoritesStore((s) => s.toggle)
  const active = selectIsFavorite(favorites, animeId)

  return (
    <Button
      // RN has no `aria-pressed`; `selected` is the closest toggle state.
      accessibilityState={{ selected: active }}
      onPress={() => toggle({ animeId, title, titleEnglish, posterUrl, score })}
      size={size}
      style={active ? styles.active : undefined}
      variant={variant}>
      <Heart color={colors.foreground} fill={active ? colors.foreground : 'transparent'} size={16} />
      <Text style={[styles.label, size === 'sm' && styles.labelSm]}>
        {active ? t('myList.inList') : t('myList.addTo')}
      </Text>
    </Button>
  )
}

const styles = StyleSheet.create({
  /** Selected state: a brighter outline on the transparent variants. */
  active: { borderColor: colors.primary },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
  labelSm: { fontSize: 12, lineHeight: 16 },
})
