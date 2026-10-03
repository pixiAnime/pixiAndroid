/**
 * My List — local favorites/watchlist with add/remove everywhere else.
 *
 * Direct port of `pixiWeb/src/pages/MyList/MyList.tsx`: same header
 * (title + count subtitle), same empty state, same per-entry rows
 * (poster → anime detail, title, score + "added …" meta, Watch and remove
 * actions). The web page has no confirmation dialog here — removal is a
 * single tap on the row's trash affordance — so neither does this one.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Heart, Play, Trash2 } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { SafeImage } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/format'
import type { RootStackParamList } from '@/navigation/types'
import { useFavoritesStore } from '@/stores/favoritesStore'
import { colors, fonts, radii, spacing, text } from '@/theme'

import '@/i18n'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function MyListPage() {
  const { t } = useTranslation()
  const navigation = useNavigation<Nav>()

  const favorites = useFavoritesStore((s) => s.favorites)
  const toggle = useFavoritesStore((s) => s.toggle)

  return (
    <ScreenLayout contentStyle={styles.page}>
      {/* `space-y-6` stack from the web page */}
      <View style={styles.stack}>
        <View style={styles.headerTitles}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('nav.myList')}
          </Text>
          <Text style={styles.subtitle}>
            {favorites.length > 0
              ? t('myList.subtitleCount', { count: favorites.length })
              : t('myList.subtitleEmpty')}
          </Text>
        </View>

        {favorites.length === 0 ? (
          <EmptyState
            title={t('myList.emptyTitle')}
            description={t('myList.emptyDesc')}
            icon={<Heart size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
          />
        ) : (
          <View style={styles.list}>
            {favorites.map((fav) => (
              <View key={fav.animeId} style={styles.row}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('common.openAria', {
                    title: fav.titleEnglish ?? fav.title,
                  })}
                  onPress={() => navigation.navigate('AnimeDetail', { malId: fav.animeId })}
                  style={styles.posterButton}>
                  <SafeImage src={fav.posterUrl} alt="" aspectRatio={2 / 3} style={styles.poster} />
                </Pressable>

                <View style={styles.body}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => navigation.navigate('AnimeDetail', { malId: fav.animeId })}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {fav.titleEnglish ?? fav.title}
                    </Text>
                  </Pressable>

                  <Text style={styles.meta}>
                    {fav.score ? `★ ${fav.score.toFixed(2)} · ` : ''}
                    {t('myList.added', { when: formatRelativeTime(fav.addedAt) })}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Button
                    size="sm"
                    onPress={() =>
                      navigation.navigate('Watch', { malId: fav.animeId, episode: 1 })
                    }>
                    <Play size={13} color={colors.primaryForeground} strokeWidth={1.6} />
                    <Text style={styles.ctaLabel}>{t('common.watch')}</Text>
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    accessibilityLabel={t('myList.removeAria', { title: fav.title })}
                    onPress={() => toggle(fav)}>
                    <Trash2 size={15} color={colors.foreground} strokeWidth={1.6} />
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenLayout>
  )
}

const styles = StyleSheet.create({
  page: { gap: 40 },
  /** Web page root is `space-y-6`. */
  stack: { gap: spacing.xl },

  headerTitles: { gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.md,
  },
  posterButton: { flexShrink: 0 },
  /** `w-12` on a phone (`sm:w-14` never applies here). */
  poster: { width: 48, borderRadius: radii.sm, overflow: 'hidden' },
  body: { flex: 1, minWidth: 0, gap: spacing.half },
  rowTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  /** `font-mono text-[0.7rem] text-muted-foreground` — not uppercased. */
  meta: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    color: colors.mutedForeground,
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.s1_5, flexShrink: 0 },
  /** Label on the white (default-variant) Watch button. */
  ctaLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.primaryForeground,
  },
})
