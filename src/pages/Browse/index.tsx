/**
 * Browse / discovery — genre chips + combined filters (type, status,
 * season, year, rating, sort). Port of `pixiWeb/src/pages/Browse/Browse.tsx`.
 *
 * The web drives every filter from the query string (`useSearchParams`), so
 * the URL *is* the state. The RN analogue is the route params: filters are
 * seeded from `route.params` on mount, kept in component state, and written
 * back with `navigation.setParams` — that keeps them alive across
 * re-renders, makes Home's "View all" deep links behave like `?type=…`, and
 * lets a later param change (external navigation) be re-adopted.
 */
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack'
import { Loader2, RotateCcw } from '@/components/icons'
import { useTranslation } from 'react-i18next'

import { AnimeCard } from '@/components/anime'
import { ScreenLayout } from '@/components/layout'
import { AnimeGridSkeleton, EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Chip, Skeleton } from '@/components/ui/Primitives'
import { SelectField, type SelectOption } from '@/components/ui/SelectField'
import { useBrowseAnime, useGenres } from '@/hooks/useAnimeData'
import { filterAdult } from '@/lib/contentPreferences'
import type { RootStackParamList } from '@/navigation/types'
import { colors, fonts, radii, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

/* ------------------------------------------------------------------ */
/* Filter definitions                                                  */
/* ------------------------------------------------------------------ */

const ALL = 'all'

type FilterKey = 'type' | 'status' | 'season' | 'year' | 'rating' | 'order_by'

interface FilterOption {
  value: string
  /** i18n key — used when the label is translated. */
  key?: string
  /** Literal label — used for the fixed rating abbreviations. */
  label?: string
}

const TYPE_OPTIONS: FilterOption[] = [
  { value: ALL, key: 'browse.options.anyType' },
  { value: 'tv', key: 'browse.options.tv' },
  { value: 'movie', key: 'browse.options.movie' },
  { value: 'ova', key: 'browse.options.ova' },
  { value: 'ona', key: 'browse.options.ona' },
  { value: 'special', key: 'browse.options.special' },
  { value: 'music', key: 'browse.options.music' },
]

const STATUS_OPTIONS: FilterOption[] = [
  { value: ALL, key: 'browse.options.anyStatus' },
  { value: 'airing', key: 'browse.options.airing' },
  { value: 'complete', key: 'browse.options.complete' },
  { value: 'upcoming', key: 'browse.options.upcoming' },
]

const SEASON_OPTIONS: FilterOption[] = [
  { value: ALL, key: 'browse.options.anySeason' },
  { value: 'winter', key: 'browse.options.winter' },
  { value: 'spring', key: 'browse.options.spring' },
  { value: 'summer', key: 'browse.options.summer' },
  { value: 'fall', key: 'browse.options.fall' },
]

const RATING_OPTIONS: FilterOption[] = [
  { value: ALL, key: 'browse.options.anyRating' },
  { value: 'g', label: 'G' },
  { value: 'pg', label: 'PG' },
  { value: 'pg13', label: 'PG-13' },
  { value: 'r17', label: 'R-17+' },
  { value: 'r', label: 'R+' },
]

const SORT_OPTIONS: FilterOption[] = [
  { value: 'score', key: 'browse.options.score' },
  { value: 'popularity', key: 'browse.options.popularity' },
  { value: 'members', key: 'browse.options.members' },
  { value: 'favorites', key: 'browse.options.favorites' },
  { value: 'start_date', key: 'browse.options.startDate' },
  { value: 'title', key: 'browse.options.title' },
  { value: 'updated', key: 'browse.options.recentlyUpdated' },
]

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS: FilterOption[] = [
  { value: ALL, key: 'browse.options.anyYear' },
  ...Array.from({ length: currentYear - 1969 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
]

/** Genres worth surfacing first (spec §9 list, intersected with Jikan). */
const FEATURED_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Supernatural', 'Psychological', 'Sports', 'Isekai',
]

/* ------------------------------------------------------------------ */
/* Params helpers — the RN stand-in for URLSearchParams                */
/* ------------------------------------------------------------------ */

type BrowseParams = NonNullable<RootStackParamList['Browse']>

/** "No filters" — also what `Reset` pushes back into the route. */
const NO_PARAMS: BrowseParams = {}

const CLEARED_PARAMS: BrowseParams = {
  genres: undefined,
  type: undefined,
  status: undefined,
  season: undefined,
  year: undefined,
  rating: undefined,
  order_by: undefined,
  sort: undefined,
  page: undefined,
  q: undefined,
}

/** Params whose values are actually set (a key holding `undefined` is unset). */
function activeKeys(params: BrowseParams): string[] {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
}

/** Order-independent comparison — used to adopt external param changes. */
function canonicalParams(params: BrowseParams): string {
  return activeKeys(params)
    .sort()
    .map((key) => `${key}=${String(params[key as keyof BrowseParams] ?? '')}`)
    .join('&')
}

/* ------------------------------------------------------------------ */

export function BrowsePage() {
  const { t } = useTranslation()
  const route = useRoute<NativeStackScreenProps<RootStackParamList, 'Browse'>['route']>()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const params = route.params
  const [filters, setFilters] = useState<BrowseParams>(params ?? NO_PARAMS)

  // The params are the "URL": adopt them when something else changes them
  // (deep link, or Home re-navigating to an already mounted Browse). No-op
  // for the changes this screen itself just wrote, so it never loops.
  useEffect(() => {
    const incoming = params ?? NO_PARAMS
    setFilters((prev) => (canonicalParams(prev) === canonicalParams(incoming) ? prev : incoming))
  }, [params])

  const genresQuery = useGenres()

  /** Option lists whose labels are i18n keys (`key`) or literal (`label`). */
  const localize = (options: FilterOption[]): SelectOption[] =>
    options.map((opt) => ({ value: opt.value, label: opt.key ? t(opt.key) : (opt.label ?? '') }))
  const typeOptions = localize(TYPE_OPTIONS)
  const statusOptions = localize(STATUS_OPTIONS)
  const seasonOptions = localize(SEASON_OPTIONS)
  const yearOptions = localize(YEAR_OPTIONS)
  const ratingOptions = localize(RATING_OPTIONS)
  const sortOptions = localize(SORT_OPTIONS)

  const queryFilters = useMemo(
    () => ({
      genres: filters.genres,
      type: filters.type,
      status: filters.status,
      season: filters.season,
      year: filters.year,
      rating: filters.rating,
      order_by: filters.order_by ?? 'score',
      sort: (filters.sort as 'desc' | 'asc') ?? 'desc',
      limit: 24,
    }),
    [filters],
  )

  const query = useBrowseAnime(queryFilters)
  const results = filterAdult(query.data?.pages.flatMap((p) => p.items) ?? [])

  const genres = genresQuery.data ?? []
  const featured = genres.filter((g) => FEATURED_GENRES.includes(g.name))
  const rest = genres.filter((g) => !FEATURED_GENRES.includes(g.name))

  const activeGenres = useMemo(() => {
    const raw = filters.genres
    if (!raw) return new Set<number>()
    return new Set(raw.split(',').map(Number).filter(Number.isFinite))
  }, [filters.genres])

  const hasActiveFilters =
    activeKeys(filters).some((key) => key !== 'order_by' && key !== 'sort') ||
    filters.order_by !== undefined

  /** Web: `set()` — clears the key when "All", and drops `page`. */
  function setFilter(key: FilterKey, value: string) {
    const next: BrowseParams = { ...filters, page: undefined }
    next[key] = value === ALL || !value ? undefined : value
    setFilters(next)
    navigation.setParams(next)
  }

  function setGenres(ids: number[]) {
    const next: BrowseParams = {
      ...filters,
      page: undefined,
      genres: ids.length > 0 ? ids.join(',') : undefined,
    }
    setFilters(next)
    navigation.setParams(next)
  }

  function reset() {
    setFilters(CLEARED_PARAMS)
    navigation.setParams(CLEARED_PARAMS)
  }

  function toggleGenre(id: number) {
    const next = new Set(activeGenres)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setGenres([...next])
  }

  return (
    <ScreenLayout contentStyle={styles.page}>
      {/* head */}
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('nav.browse')}
          </Text>
          <Text style={styles.subtitle}>{t('browse.description')}</Text>
        </View>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onPress={reset} accessibilityLabel={t('common.reset')}>
            <RotateCcw size={13} color={colors.foreground} strokeWidth={1.6} />
            <Text style={styles.resetLabel}>{t('common.reset')}</Text>
          </Button>
        ) : null}
      </View>

      {/* filter panel */}
      <View style={styles.panel}>
        {/* selects */}
        <View style={styles.selectGrid}>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.type')}
              value={filters.type ?? ALL}
              options={typeOptions}
              onChange={(value) => setFilter('type', value)}
            />
          </View>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.status')}
              value={filters.status ?? ALL}
              options={statusOptions}
              onChange={(value) => setFilter('status', value)}
            />
          </View>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.season')}
              value={filters.season ?? ALL}
              options={seasonOptions}
              onChange={(value) => setFilter('season', value)}
            />
          </View>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.year')}
              value={filters.year ?? ALL}
              options={yearOptions}
              onChange={(value) => setFilter('year', value)}
            />
          </View>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.rating')}
              value={filters.rating ?? ALL}
              options={ratingOptions}
              onChange={(value) => setFilter('rating', value)}
            />
          </View>
          <View style={styles.selectCell}>
            <SelectField
              label={t('browse.sortBy')}
              value={filters.order_by ?? 'score'}
              options={sortOptions}
              onChange={(value) => setFilter('order_by', value)}
            />
          </View>
        </View>

        {/* genre chips */}
        <View style={styles.genreBlock}>
          <Text style={styles.genreLabel}>
            {t('browse.genres')}
            {activeGenres.size > 0 ? (
              <Text style={styles.genreCount}>
                {t('browse.selected', { count: activeGenres.size })}
              </Text>
            ) : null}
          </Text>

          {genresQuery.isLoading ? (
            <View style={styles.chipRow}>
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} width={64} height={24} radius={0} />
              ))}
            </View>
          ) : genresQuery.isError && genres.length === 0 ? (
            <ErrorState
              error={genresQuery.error}
              onRetry={() => genresQuery.refetch()}
              compact
            />
          ) : (
            <View style={styles.chipRow}>
              {[...featured, ...rest].map((g) => (
                <Chip
                  key={g.mal_id}
                  active={activeGenres.has(g.mal_id)}
                  accessibilityLabel={g.name}
                  onPress={() => toggleGenre(g.mal_id)}>
                  {g.name}
                </Chip>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* results */}
      <View accessibilityLiveRegion="polite">
        {query.isError && results.length === 0 ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          // Heads-up: `AnimeGridSkeleton` sizes its cells at `48%` inside a
          // `gap: 16` row, which Yoga wraps to one column on phones narrower
          // than ~430dp — the loaded grid below is genuinely 2-up.
          <AnimeGridSkeleton count={12} />
        ) : results.length === 0 ? (
          <EmptyState
            title={t('browse.emptyTitle')}
            description={t('browse.emptyDesc')}
          />
        ) : (
          <View>
            <Text style={styles.count}>
              {t('browse.titles', {
                count: query.data?.pages[0]?.total || results.length,
              })}
            </Text>
            <View style={styles.grid}>
              {results.map((anime, i) => (
                <View key={`${anime.mal_id}-${i}`} style={styles.cell}>
                  <AnimeCard anime={anime} priority={i < 8} />
                </View>
              ))}
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
                  <Text style={styles.buttonLabel}>{t('common.loadMore')}</Text>
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ScreenLayout>
  )
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: { gap: 40 },

  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headCopy: { flex: 1, gap: spacing.xs },
  title: { ...text.pageHeading, color: colors.foreground },
  subtitle: { ...text.meta },
  resetLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.1,
    color: colors.foreground,
  },

  /** Filter panel surface. */
  panel: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    padding: spacing.lg,
    gap: spacing.lg,
  },

  /**
   * Web is `grid grid-cols-2 gap-3`; percentage widths plus a fixed gap
   * always exceed 100% (and even `48% + 12px` does once the row is under
   * 300dp), which Yoga resolves by wrapping to a single column — so each
   * cell owns half of the 12px gutter as padding instead.
   */
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
    marginHorizontal: -6,
  },
  selectCell: { width: '50%', paddingHorizontal: 6 },

  genreBlock: { gap: spacing.sm },
  genreLabel: { ...text.monoSmall },
  /** `ml-2 text-foreground` on the count span. */
  genreCount: { color: colors.foreground, marginLeft: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s1_5 },

  /** `mb-4` on the count line. */
  count: { ...text.monoLabel, marginBottom: spacing.lg },
  /**
   * Web: `grid grid-cols-2 gap-4`. Cells pad in their own half of the 16px
   * gutter (container bleeds 8px into the page gutters) so two columns always
   * fit and the grid still lands flush with the rest of the page content.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
    marginHorizontal: -(spacing.lg / 2),
  },
  cell: { width: '50%', paddingHorizontal: spacing.lg / 2 },
  /** `flex justify-center pt-6`. */
  loadMore: { alignItems: 'center', paddingTop: spacing.xl },
  buttonLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    color: colors.foreground,
  },
})
