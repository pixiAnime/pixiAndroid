/**
 * pixiWeb's design tokens, ported to React Native.
 *
 * The web build is Tailwind v4 CSS-first (`src/index.css`, `@theme inline`) —
 * there is no `tailwind.config` to read — so the values below are transcribed
 * from `:root` in that file. The site is dark-only and explicitly monochrome:
 * *"All color comes from anime artwork; chrome is strictly grayscale."* The
 * only chromatic token is `--destructive`, and it is error-only.
 *
 * Two rules from the web build that must survive the port:
 *
 *  1. **Page surfaces are square.** Every panel is `border border-border
 *     bg-card` with no radius; radii only appear on controls (`rounded-lg`,
 *     2px) and badges (`rounded-4xl`, 5.2px).
 *  2. **Mono micro-labels are the signature.** `font-mono` uppercase at
 *     9.6 / 10.4 / 11.2px with wide tracking carry every meta line, so
 *     `Geist Mono` has to be pinned rather than requested via `fontWeight` —
 *     see `fonts` below for why.
 */

import type { TextStyle } from 'react-native'

/**
 * Android resolves a `fontFamily` to a file in `assets/fonts/`, but mapping
 * `fontWeight` onto Medium/SemiBold of a family does not work: a probe showed
 * `fontFamily: 'Geist'` + `fontWeight: '600'` renders Regular, while
 * `fontFamily: 'Geist-SemiBold'` renders the real SemiBold face. So we always
 * name the file base explicitly and never combine it with `fontWeight`.
 */
export const fonts = {
  regular: 'Geist-Regular',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-Bold',
  mono: 'GeistMono-Regular',
  monoMedium: 'GeistMono-Medium',
  monoSemibold: 'GeistMono-SemiBold',
} as const

export type FontKey = keyof typeof fonts

export const colors = {
  background: '#0a0a0a',
  foreground: '#fcfcfc',

  card: '#111111',
  cardForeground: '#fcfcfc',
  popover: '#111111',

  /** White *is* the accent — primary controls are inverted, not tinted. */
  primary: '#fcfcfc',
  primaryForeground: '#0a0a0a',

  secondary: '#1e1e1e',
  secondaryForeground: '#fcfcfc',

  muted: '#191919',
  mutedForeground: '#929292',

  accent: '#242424',

  /** Functional only, never decorative. */
  destructive: '#f0565a',

  border: 'rgba(255,255,255,0.10)',
  input: 'rgba(255,255,255,0.15)',
  ring: '#aeaeae',

  /** 10% white over `background` — used for `bg-muted/40` and skeletons. */
  overlay: 'rgba(255,255,255,0.04)',
} as const

/** 4px grid, matching Tailwind's defaults. */
export const spacing = {
  none: 0,
  hair: 1,
  px: 1,
  half: 2,
  xs: 4,
  s1_5: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const

/**
 * `--radius: 0.125rem` (2px) scaled the way `index.css` scales it. Page-level
 * surfaces use `radii.none`; controls use `radii.lg`; badges `radii.badge`.
 */
export const radii = {
  none: 0,
  sm: 1.2,
  md: 1.6,
  lg: 2,
  xl: 2.8,
  badge: 5.2,
  pill: 999,
} as const

/** Fixed layout constants lifted from the web shell. */
export const layout = {
  headerHeight: 52,
  bottomNavHeight: 56,
  /** Tailwind `max-w-7xl` — irrelevant on a phone, kept as the content cap. */
  contentMaxWidth: 1280,
  contentPaddingX: 16,
  contentPaddingY: 24,
  /** `ROW_CARD_CLASS`: keeps horizontal rows from jumping while loading. */
  rowCardWidth: 144,
} as const

export type TextVariant =
  | 'pageHeading'
  | 'heroTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'body'
  | 'bodySm'
  | 'meta'
  | 'monoMicro'
  | 'monoSmall'
  | 'monoLabel'
  | 'monoValue'
  | 'statValue'
  | 'errorNumeral'
  | 'navLabel'

/**
 * Text presets keyed by the web's Tailwind usage, so a page ported from
 * `className` strings can be matched token-for-token.
 */
export const text: Record<TextVariant, TextStyle> = {
  /** `font-heading text-lg font-semibold tracking-tight` */
  pageHeading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  /** `text-2xl → 4xl font-semibold` (hero + detail titles) */
  heroTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  /** `font-heading text-sm font-medium tracking-wide uppercase` */
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** `text-[0.8rem] font-medium` */
  cardTitle: { fontFamily: fonts.medium, fontSize: 12.8, lineHeight: 18 },
  /** `text-sm` */
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  /** `text-xs` */
  bodySm: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  /** `text-xs text-muted-foreground` */
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  /** `font-mono text-[0.6rem] tracking-wide uppercase` */
  monoMicro: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  /** `font-mono text-[0.65rem] tracking-wide uppercase` */
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 10.4,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  /** `font-mono text-[0.7rem] tracking-wide uppercase` */
  monoLabel: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  /** `font-mono text-sm tabular-nums` */
  monoValue: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  /** `font-mono text-5xl font-bold tabular-nums text-foreground/20` */
  statValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  /** `font-mono text-6xl font-bold text-foreground/20` (404 / route errors) */
  errorNumeral: {
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
    color: colors.foreground,
    opacity: 0.2,
  },
  /** `font-mono text-[0.6rem] uppercase` (bottom nav labels) */
  navLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.6,
    lineHeight: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
}

export const theme = { colors, spacing, radii, fonts, text, layout } as const

export type Theme = typeof theme
