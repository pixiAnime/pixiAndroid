/**
 * `VirtualListLayout` — `ScreenLayout` for a page whose body is a long list.
 *
 * `ScreenLayout` puts the whole page inside one `ScrollView`, so a page like
 * History renders every row — and every poster — as soon as it is mounted: 100
 * entries ≈ 100 Fresco requests plus a thousand-odd native views on the very
 * frame the screen opens. RN's `Image` has no `loading="lazy"`, so the only
 * fix is to stop mounting rows that are off-screen: this is that, with the
 * scroll container swapped for a windowed `FlatList`.
 *
 * Everything else is reproduced from `ScreenLayout` on purpose, so the two
 * layouts are pixel-identical for the same page:
 *
 *   - gutters (`padded`) live on the content container, not the root;
 *   - `flexGrow: 1` + `paddingBottom: spacing.xxl` keep the footer pinned the
 *     same way `styles.content` does;
 *   - `useScrollToTop` so a tab tap returns the list to the top (the web's
 *     `ScrollRestoration`).
 *
 * Vertical rhythm comes from per-slot padding rather than a `gap` on the
 * container (a container `gap` cannot differ between header→first row,
 * row→row and last row→footer):
 *
 *   header   → `spacing.xl`   (the pages' `stack { gap }`)
 *   row → row   → `rowGap`      (the pages' `list { gap }`, default `spacing.sm`)
 *   last row → footer → `footerGap` (the pages' `page { gap: 40 }`, i.e. web `space-y-10`)
 *
 * Cells are padded rather than margin-spaced, and `removeClippedSubviews` is
 * deliberately left off — both interact badly on Android (clipped cell
 * tails), and windowing already removes the off-screen work that matters.
 */
import { useRef, type ReactElement, type ReactNode } from 'react'
import { FlatList, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useScrollToTop } from '@react-navigation/native'

import { Footer } from '@/components/layout/Footer'
import { layout, spacing } from '@/theme'

/** The pages' `styles.page = { gap: 40 }` — the web's `space-y-10`. */
const FOOTER_GAP = 40
/** Enough rows to cover a viewport plus a margin of prefetched posters. */
const INITIAL_ROWS = 8
const WINDOW_VIEWPORTS = 7
const BATCH_ROWS = 8

export interface VirtualListLayoutProps<T> {
  data: readonly T[]
  keyExtractor: (item: T, index: number) => string
  renderItem: (item: T) => ReactElement | null
  /** Above the list — a page header. Sits `spacing.xl` above the first row. */
  header?: ReactNode
  /** Shown in place of the rows when `data` is empty. */
  empty?: ReactNode
  /** Gap between rows — the pages' `list { gap }`. */
  rowGap?: number
  /** `false` for full-bleed pages that opt out of the page gutters. */
  padded?: boolean
  /** Rendered after the list — the web puts `<Footer>` at the document end. */
  footer?: boolean
  /** Outside the list flow entirely (dialogs render in their own window). */
  overlay?: ReactNode
  contentStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

export function VirtualListLayout<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  rowGap = spacing.sm,
  padded = true,
  footer = true,
  overlay,
  contentStyle,
  style,
}: VirtualListLayoutProps<T>) {
  const ref = useRef<FlatList<T>>(null)
  // Same cast as `ScreenLayout`: React Navigation's `ScrollableWrapper` is
  // structurally satisfied by a FlatList ref, but not admit-able to TS.
  useScrollToTop(ref as never)

  const gutters = padded
    ? { paddingHorizontal: layout.contentPaddingX, paddingVertical: layout.contentPaddingY }
    : null
  const last = data.length - 1

  return (
    <View style={[styles.body, style]}>
      <FlatList
        ref={ref}
        contentContainerStyle={[styles.content, gutters, contentStyle]}
        contentInsetAdjustmentBehavior="never"
        data={data}
        initialNumToRender={INITIAL_ROWS}
        keyboardShouldPersistTaps="handled"
        keyExtractor={keyExtractor}
        ListEmptyComponent={empty ? <View>{empty}</View> : undefined}
        ListFooterComponent={
          footer ? (
            <View style={styles.footer}>
              <Footer />
            </View>
          ) : undefined
        }
        ListHeaderComponent={header ? <View style={styles.header}>{header}</View> : undefined}
        maxToRenderPerBatch={BATCH_ROWS}
        renderItem={({ item, index }) => (
          <View style={index === last ? null : { paddingBottom: rowGap }}>
            {renderItem(item)}
          </View>
        )}
        showsVerticalScrollIndicator={false}
        /* Same `style={styles.body}` ScreenLayout puts on its ScrollView. */
        style={styles.body}
        windowSize={WINDOW_VIEWPORTS}
      />
      {overlay}
    </View>
  )
}

const styles = StyleSheet.create({
  /** `flex: 1` root so the list owns all remaining height (ScreenLayout's). */
  body: { flex: 1 },
  /** ScreenLayout's `styles.content`, minus the `gap` (see the docblock). */
  content: { flexGrow: 1, paddingBottom: spacing.xxl },
  /** `stack { gap: spacing.xl }` — header to first row. */
  header: { paddingBottom: spacing.xl },
  /** `page { gap: 40 }` — last row (or empty state) to the footer. */
  footer: { paddingTop: FOOTER_GAP },
})
