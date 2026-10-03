/**
 * SectionScroller — titled horizontal row of anime cards.
 *
 * Desktop shows arrow controls; smaller screens scroll horizontally with
 * snap. RN has no `scrollbar-width: none` (hiding the indicator is a prop)
 * and no CSS scroll-snap, so snapping is approximated with `decelerationRate`
 * while the arrow controls — the web's hover affordance — stay visible
 * whenever they are on screen (`sm:` and up), since touch has no hover.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { colors, spacing, text } from '@/theme'

// Side-effect: bootstraps the i18next singleton (web: `main.tsx`).
import '@/i18n'

interface SectionScrollerProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Rendered at the right of the header (e.g. "View all" link). */
  action?: ReactNode
  /** Merged onto the root — the port of the web `className`. */
  style?: StyleProp<ViewStyle>
}

/** Tailwind `sm:` — the web hides the subtitle and arrows below it. */
const SM_BREAKPOINT = 640

export function SectionScroller({
  title,
  subtitle,
  children,
  action,
  style,
}: SectionScrollerProps) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const wide = width >= SM_BREAKPOINT
  const scrollerRef = useRef<ScrollViewInstance>(null)
  const offsetRef = useRef(0)
  const [viewportWidth, setViewportWidth] = useState(0)

  const scrollBy = useCallback(
    (direction: 1 | -1) => {
      // Web: `Math.max(el.clientWidth * 0.8, 240)` + smooth `scrollBy`.
      const amount = Math.max(viewportWidth * 0.8, 240)
      const target = Math.max(0, offsetRef.current + direction * amount)
      offsetRef.current = target
      scrollerRef.current?.scrollTo({ x: target, animated: true })
    },
    [viewportWidth],
  )

  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.titleText}>
            {title}
          </Text>
          {subtitle && wide ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.actions}>
          {action}
          {wide ? (
            <View style={styles.arrows}>
              <Button
                accessibilityLabel={t('a11y.scrollLeft', { title })}
                onPress={() => scrollBy(-1)}
                size="iconSm"
                variant="outline">
                <ChevronLeft color={colors.foreground} size={16} strokeWidth={1.6} />
              </Button>
              <Button
                accessibilityLabel={t('a11y.scrollRight', { title })}
                onPress={() => scrollBy(1)}
                size="iconSm"
                variant="outline">
                <ChevronRight color={colors.foreground} size={16} strokeWidth={1.6} />
              </Button>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        accessibilityLabel={title}
        accessibilityRole="list"
        contentContainerStyle={{ gap: wide ? spacing.lg : spacing.md, paddingBottom: spacing.xs }}
        decelerationRate="fast"
        horizontal
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        onScroll={(event) => {
          offsetRef.current = event.nativeEvent.contentOffset.x
        }}
        ref={scrollerRef}
        scrollEventThrottle={32}
        showsHorizontalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  titleText: { ...text.sectionTitle, color: colors.foreground },
  /** `font-mono text-[0.65rem] text-muted-foreground` — never uppercased. */
  subtitle: { ...text.monoSmall, letterSpacing: 0, textTransform: 'none' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrows: { flexDirection: 'row', gap: spacing.xs },
})
