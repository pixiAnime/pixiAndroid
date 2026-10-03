/**
 * SafeImage — aspect-locked image with graceful fallback.
 *
 * The web build pairs `loading="lazy"` / `decoding="async"` with an `onError`
 * swap to a striped placeholder, so external artwork that 404s at any moment
 * never collapses the layout around it. RN's `Image` has no lazy/eager hint
 * (`priority` is accepted for API parity with the web component and ignored),
 * but the reserved box, the muted striped fill and the `ImageOff` glyph are
 * reproduced one-for-one.
 */
import { useId, useState } from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { ImageOff } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, Pattern, Rect } from 'react-native-svg'

import { colors } from '@/theme'

// Side-effect: bootstraps the i18next singleton (the web does this in
// `main.tsx`). `useTranslation` returns raw keys until this module evaluates.
import '@/i18n'

interface SafeImageProps {
  src?: string | null
  alt: string
  /** width ÷ height of the reserved box (web: `aspect-[2/3]`). Ignored by `fill`. */
  aspectRatio?: number
  /** Absolute-fill the parent instead of reserving an aspect box (web: `fill`). */
  fill?: boolean
  /** Extra style for the reserved box (web: `className`). */
  style?: StyleProp<ViewStyle>
  /** Above-the-fold images load eagerly on the web — kept for API parity. */
  priority?: boolean
}

/** `text-muted-foreground/60` — the placeholder glyph tint. */
const ICON_TINT = 'rgba(146,146,146,0.6)'
/** The web's `repeating-linear-gradient(135deg, rgba(255,255,255,0.04) …)`. */
const STRIPE_FILL = 'rgba(255,255,255,0.04)'

export function SafeImage({ src, alt, aspectRatio = 2 / 3, fill, style }: SafeImageProps) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const patternId = `stripes${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const showImage = Boolean(src) && !failed
  // Assembled outside JSX so the box stays a plain style reference.
  const box: ViewStyle = fill ? styles.fill : { aspectRatio }

  return (
    <View style={[styles.frame, box, style]}>
      {showImage ? (
        <Image
          accessibilityLabel={alt}
          onError={() => setFailed(true)}
          resizeMode="cover"
          source={{ uri: src as string }}
          style={styles.fill}
        />
      ) : (
        <View
          accessible
          accessibilityLabel={t('common.imageUnavailableAria', { alt })}
          accessibilityRole="image"
          style={[styles.fill, styles.fallback]}>
          <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
            <Defs>
              <Pattern
                height={16}
                id={patternId}
                patternContentUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
                width={16}>
                <Rect fill={STRIPE_FILL} height={8} width={16} />
              </Pattern>
            </Defs>
            <Rect fill={`url(#${patternId})`} height="100%" width="100%" />
          </Svg>
          <ImageOff color={ICON_TINT} size={20} strokeWidth={1.6} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.muted },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
})
