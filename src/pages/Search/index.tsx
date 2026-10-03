/**
 * Search — debounced input, route-param-synced, infinite pagination.
 * Port of `pixiWeb/src/pages/Search/Search.tsx`.
 *
 * Matches EN/JP/romaji/synonyms via Jikan's `q`. The web keeps `q` in the
 * URL (`replace: true`, so typing doesn't spam history); here the route
 * params play that role — the debounced value is written back with
 * `navigation.setParams`, and the query reads `q` back out of the params so
 * a deep link (`/search?q=…` → `Search: { q }`) behaves identically.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack'
import { Loader2, Search, X } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { AnimeCard } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { AnimeCardSkeleton, AnimeGridSkeleton, EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAnimeSearch } from '@/hooks/useAnimeData'
import { useDebouncedValue } from '@/hooks/useDebounce'
import type { RootStackParamList } from '@/navigation/types'
import { colors, fonts, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

export function SearchPage() {
  const { t } = useTranslation()
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Search'>['route']>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const urlQuery = route.params?.q ?? ''

  const [input, setInput] = useState(urlQuery)
  const debounced = useDebouncedValue(input, 300)
  const inputRef = useRef<TextInputInstance>(null)

  // Keep the params in sync (web: `setSearchParams(…, { replace: true })` →
  // no history spam while typing). Converges immediately once they match.
  useEffect(() => {
    const next = debounced.trim()
    if (next === urlQuery.trim()) return
    navigation.setParams({ q: next || undefined })
  }, [debounced, urlQuery, navigation])

  // Focus the input on mount (nav → search should feel instant).
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const clear = () => {
    setInput('')
    inputRef.current?.focus()
  }

  const trimmed = urlQuery.trim()
  const query = useAnimeSearch({ q: trimmed, limit: 24 }, trimmed.length > 0)

  const results = query.data?.pages.flatMap((p) => p.items) ?? []
  const isLoading = query.isLoading || query.isFetchingNextPage
  const showInitialSkeleton = query.isLoading && trimmed.length > 0

  return (
    <ScreenLayout contentStyle={styles.page}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('nav.search')}
        </Text>
        <Text style={styles.subtitle}>{t('search.description')}</Text>
      </View>

      {/* input — `relative max-w-2xl`, icon left, clear right */}
      <View style={styles.field}>
        <View importantForAccessibility="no" style={styles.leadingIcon}>
          <Search size={16} color={colors.mutedForeground} strokeWidth={1.6} />
        </View>
        <Input
          ref={inputRef}
          mono
          value={input}
          onChangeText={setInput}
          placeholder={t('common.searchAnimePlaceholder')}
          accessibilityLabel={t('common.searchAnime')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {input ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('search.clearAria')}
            hitSlop={8}
            onPress={clear}
            style={styles.clear}>
            <X size={14} color={colors.mutedForeground} strokeWidth={1.6} />
          </Pressable>
        ) : null}
      </View>

      {/* states — one region so the internal count / grid / load-more gaps
          match the web (`space-y-6` between them, `pt-2` on the button). */}
      <View style={styles.results}>
        {trimmed.length === 0 ? (
          <EmptyState
            title={t('search.startTitle')}
            description={t('search.startDesc')}
            icon={<Search size={20} color={colors.mutedForeground} strokeWidth={1.6} />}
          />
        ) : query.isError && results.length === 0 ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : showInitialSkeleton ? (
          // See the Browse page: `AnimeGridSkeleton`'s `48% + gap: 16` cells
          // wrap to one column on phones narrower than ~430dp.
          <AnimeGridSkeleton count={12} />
        ) : results.length === 0 && !isLoading ? (
          <EmptyState
            title={t('search.noResults', { query: trimmed })}
            description={t('search.noResultsDesc')}
          />
        ) : (
          <>
            <Text accessibilityLiveRegion="polite" style={styles.count}>
              {t('search.results', {
                count: query.data?.pages[0]?.total || results.length,
              })}
              {query.isFetching && !query.isFetchingNextPage
                ? ` · ${t('search.updating')}`
                : ''}
            </Text>

            <View style={styles.grid}>
              {results.map((anime, i) => (
                <View key={`${anime.mal_id}-${i}`} style={styles.cell}>
                  <AnimeCard anime={anime} priority={i < 8} />
                </View>
              ))}
              {query.isFetchingNextPage
                ? Array.from({ length: 5 }, (_, i) => (
                    <View key={`ph-${i}`} style={styles.cell}>
                      <AnimeCardSkeleton />
                    </View>
                  ))
                : null}
            </View>

            {query.hasNextPage ? (
              <View style={styles.loadMore}>
                <Button
                  variant="outline"
                  onPress={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}>
                  {query.isFetchingNextPage ? (
                    <Loader2 size={14} color={colors.foreground} strokeWidth={1.6} />
                  ) : null}
                  <Text style={styles.buttonLabel}>{t('search.loadMoreResults')}</Text>
                </Button>
              </View>
            ) : null}
          </>
        )}
      </View>
    </ScreenLayout>
  )
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: { gap: 40 },

  head: { gap: spacing.sm },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },

  /**
   * Web: `relative max-w-2xl`. The input is the only in-flow child, so the
   * absolutely positioned icon and clear button span its full 40px height
   * (no `top-1/2 -translate-y-1/2` needed).
   */
  field: { position: 'relative', maxWidth: 672, alignSelf: 'stretch' },
  /** `absolute left-3 size-4 top-1/2 -translate-y-1/2`. */
  leadingIcon: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: 0,
    zIndex: 1,
    justifyContent: 'center',
  },
  /** `h-10 pr-10 pl-9 font-mono text-sm` on top of the `Input` defaults. */
  searchInput: { height: 40, paddingLeft: 36, paddingRight: 40, fontSize: 14 },
  /** `absolute right-2 size-6 …` clear affordance. */
  clear: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 24,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** `space-y-6` between the count line, the grid and the load-more row. */
  results: { gap: spacing.xl },
  count: { ...text.monoLabel },
  /**
   * Web: `grid grid-cols-2 gap-4` — percentage widths plus a fixed gap
   * always exceed 100% (and even `48% + 16px` does once the row is under
   * 400dp), which Yoga resolves by wrapping to a single column, so each cell
   * owns half of the 16px gutter as padding: the container bleeds 8px into
   * the page gutters and the grid still lands flush with the page content.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginHorizontal: -(spacing.lg / 2),
  },
  cell: { width: '50%', paddingHorizontal: spacing.lg / 2 },
  /** `flex justify-center pt-2` (on top of the container's `space-y-6`). */
  loadMore: { alignItems: 'center', paddingTop: spacing.sm },
  buttonLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
})
