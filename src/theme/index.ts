/**
 * Material 3 (Material You–inspired) dark design tokens for PixiAndroid.
 *
 * This file is the single visual source of truth for the whole app. It is
 * mobile-owned (see `shared-manifest.json`), so it is free to diverge from
 * pixiWeb's monochrome Tailwind theme.
 *
 * The system is deliberately restrained:
 *
 *  1. **Chrome is neutral.** Surfaces come from the M3 dark tonal ladder
 *     (`surface` → `surfaceContainerLowest…Highest`), never from a gradient or
 *     a decorative tint. Depth is expressed with *tonal* elevation (a lighter
 *     surface container), not drop shadows.
 *  2. **Colour is functional only.** The single exception to the monochrome
 *     rule is the connection-status set plus `error`, which must be readable at
 *     a glance. Nothing else is chromatic.
 *  3. **Shape is a scale, not a mood.** `radii` is the M3-ish ladder
 *     (4 / 8 / 12 / 16 / 28 / pill); controls use `pill`, cards and fields
 *     `lg` (12), sheets and dialogs `xxl` (28). No oversized rounding.
 *  4. **Type is a scale.** Display → Label presets sit on the bundled Geist
 *     faces; the mono presets are kept for technical metadata (URLs, ids,
 *     counts, timers) where a fixed-width face reads better.
 *
 * `colors` keeps the old pixiWeb key names as aliases so an un-migrated caller
 * still compiles and, more importantly, still renders an M3 surface.
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
  /* ---------------------------------------------------------- M3 surfaces */
  surface: '#101214',
  surfaceDim: '#101214',
  surfaceBright: '#36393D',
  surfaceContainerLowest: '#0B0D0E',
  surfaceContainerLow: '#17191B',
  surfaceContainer: '#1B1D1F',
  surfaceContainerHigh: '#242629',
  surfaceContainerHighest: '#2E3033',

  onSurface: '#E4E6E8',
  onSurfaceVariant: '#A9ADB2',
  outline: '#4A4D51',
  outlineVariant: '#2A2D30',

  /* ------------------------------------------------------------ M3 accents */
  /** Inverted controls: a light neutral, never a chromatic accent. */
  primary: '#E4E6E8',
  onPrimary: '#101214',
  primaryContainer: '#3A3D40',
  onPrimaryContainer: '#E4E6E8',

  /** Tonal buttons/chips — a slightly proud surface, not a colour. */
  secondaryContainer: '#2A2D30',
  onSecondaryContainer: '#E4E6E8',

  /* ------------------------------------------------- functional status hues */
  statusRunning: '#5DD39E',
  statusRunningContainer: 'rgba(93,211,158,0.14)',
  statusConnecting: '#E5B567',
  statusConnectingContainer: 'rgba(229,181,103,0.14)',
  statusError: '#F0565A',
  statusErrorContainer: 'rgba(240,86,90,0.14)',
  statusStopped: '#9AA0A6',
  statusStoppedContainer: 'rgba(154,160,166,0.14)',

  /* ----------------------------------------------------------------- error */
  error: '#F0565A',
  onError: '#101214',
  errorContainer: 'rgba(240,86,90,0.14)',
  onErrorContainer: '#F5A9AB',

  scrim: 'rgba(0,0,0,0.55)',

  /* ------------------------------------------- legacy aliases (mapped to M3) */
  background: '#101214',
  foreground: '#E4E6E8',
  card: '#1B1D1F',
  cardForeground: '#E4E6E8',
  popover: '#242629',
  primaryForeground: '#101214',
  secondary: '#2A2D30',
  secondaryForeground: '#E4E6E8',
  muted: '#1B1D1F',
  mutedForeground: '#A9ADB2',
  accent: '#2E3033',
  destructive: '#F0565A',
  border: '#2A2D30',
  input: '#4A4D51',
  ring: '#8E9196',
  /** 4% white over any surface — pressed/selected state layers and skeletons. */
  overlay: 'rgba(255,255,255,0.04)',
} as const

/** 4px grid. */
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
 * M3-inspired shape ladder. Page-level *list rows* stay near-square via `md`,
 * cards/fields are `lg`, sheets/dialogs are `xxl`, and every tappable control
 * is `pill`.
 */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 28,
  badge: 999,
  pill: 999,
} as const

/** Fixed layout constants (M3 top app bar + navigation bar heights). */
export const layout = {
  headerHeight: 56,
  bottomNavHeight: 80,
  /** Tailwind `max-w-7xl` — irrelevant on a phone, kept as the content cap. */
  contentMaxWidth: 1280,
  contentPaddingX: 16,
  contentPaddingY: 20,
  /** Keeps horizontal rows from jumping while loading. */
  rowCardWidth: 144,
  /** M3 minimum touch target. */
  minTouchTarget: 48,
} as const

/** Responsive tiers — the web's `sm:` (640) and `lg:` (1024) breakpoints. */
export const breakpoints = { sm: 640, lg: 1024 } as const

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
  | 'titleLarge'
  | 'titleMedium'
  | 'labelLarge'
  | 'labelMedium'

/**
 * Text presets. Each maps to a rung of the M3 type scale, rendered on Geist.
 * Colours are applied by the caller unless a preset is inherently muted.
 */
export const text: Record<TextVariant, TextStyle> = {
  /** HeadlineSmall — page titles. */
  pageHeading: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  /** HeadlineMedium — hero + detail titles. */
  heroTitle: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  /** TitleSmall — section headers. */
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  /** TitleSmall (regular weight) — card titles. */
  cardTitle: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  /** BodyMedium. */
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  /** BodySmall. */
  bodySm: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  /** BodySmall muted. */
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant },
  /** Mono micro — the smallest technical label. */
  monoMicro: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  /** Mono small. */
  monoSmall: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  /** Mono label — section-scale technical label. */
  monoLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
  /** Mono tabular value. */
  monoValue: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  /** Stat value. */
  statValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  /** 404 / route errors. */
  errorNumeral: {
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 56,
    fontVariant: ['tabular-nums'],
    color: colors.onSurface,
    opacity: 0.2,
  },
  /** Navigation-bar labels. */
  navLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  /** TitleLarge — dialog / sheet titles. */
  titleLarge: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  /** TitleMedium — list-item titles. */
  titleMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, letterSpacing: 0.1 },
  /** LabelLarge — button labels. */
  labelLarge: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  /** LabelMedium — chip / small-control labels. */
  labelMedium: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
}

export const theme = { colors, spacing, radii, fonts, text, layout, breakpoints } as const

export type Theme = typeof theme
