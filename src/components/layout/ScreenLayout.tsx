/**
 * `ScreenLayout` — the RN equivalent of the web's `<main class="mx-auto
 * max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">` inside `RootLayout`.
 *
 * Every route renders inside this, so page content gets identical gutters
 * and a consistent scroll container. It also reproduces `ScrollRestoration`:
 * React Navigation's `useScrollToTop` returns the focused screen to the top
 * when it regains focus, which is what the web does on pathname change.
 */
import { useRef, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useScrollToTop } from '@react-navigation/native'

import { Footer } from '@/components/layout/Footer'
import { layout, spacing } from '@/theme'

export interface ScreenLayoutProps {
  children: ReactNode
  /** `false` for screens that manage their own scrolling (the player). */
  scroll?: boolean
  /** `false` for full-bleed screens that opt out of the page gutters. */
  padded?: boolean
  /** Rendered after the page body — the web puts `<Footer>` at the end of the document. */
  footer?: boolean
  /** Extra styles for the scroll content — used by pages that stack gaps. */
  contentStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

export function ScreenLayout({
  children,
  scroll = true,
  padded = true,
  footer = true,
  contentStyle,
  style,
}: ScreenLayoutProps) {
  const ref = useRef<React.ElementRef<typeof ScrollView>>(null)
  // `useScrollToTop` wants React Navigation's own `ScrollableWrapper`, which
  // RN's ScrollView ref structurally satisfies but TS won't admit — hence the
  // cast rather than a reimplementation of `ScrollRestoration`.
  useScrollToTop(ref as never)

  const gutters = padded
    ? { paddingHorizontal: layout.contentPaddingX, paddingVertical: layout.contentPaddingY }
    : null

  if (!scroll) {
    return (
      <View style={styles.body}>
        {/*
         * Tablet: cap the column and center it (the web's `mx-auto max-w-7xl`).
         * The outer view still owns the full width so full-bleed surfaces keep
         * their background edge to edge.
         */}
        <View style={[styles.centeredFill, padded && gutters, style]}>{children}</View>
      </View>
    )
  }

  return (
    <ScrollView
      ref={ref}
      style={styles.body}
      contentContainerStyle={[styles.content, styles.centered, gutters, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never">
      {/*
       * `flexGrow` (not `flex: 1`) on both wrappers: `flex: 1` also sets
       * `flexBasis: 0`, which would collapse short pages inside a
       * content-sized scroll container. Plain `flexGrow` keeps the base size
       * at the content height, lets the body absorb leftover viewport space
       * and lands the footer on the bottom edge — the same geometry as the
       * web's `<main class="flex-1">` followed by `<Footer>`. Tall pages are
       * unaffected: there is no free space to distribute.
       */}
      <View style={styles.bodyGrow}>{children}</View>
      {footer ? <Footer /> : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyGrow: { flexGrow: 1 },
  /**
   * The centred content column: full width up to the cap, then centred. This is
   * where a tablet stops stretching a phone layout edge to edge (the theme's
   * `layout.contentMaxWidth`, previously defined but never applied).
   *
   * Used as a `contentContainerStyle`, so it must NOT carry `flex` — a content
   * container with `flex: 1` would be pinned to the viewport and long pages
   * would stop scrolling.
   */
  centered: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  /**
   * The same centred column for the non-scrolling branch, which DOES have to
   * fill the viewport: screens like Watch render a `flex: 1` body child next to
   * a fixed-aspect player, and that child can only resolve against a parent of
   * definite height. Without `flex: 1` here the column is content-sized and the
   * body collapses to zero — only the player would be visible.
   */
  centeredFill: {
    flex: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  content: { flexGrow: 1, gap: spacing.xxl, paddingBottom: spacing.xxl },
})
