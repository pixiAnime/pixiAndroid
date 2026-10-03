/**
 * Sheet — the one bottom sheet the player uses.
 *
 * Every secondary surface in the redesigned player (settings, subtitles,
 * episodes, servers) is a sheet rather than a popover. The old gear opened a
 * 168 px panel floating over the picture, which is a desktop affordance: on a
 * phone it sits under the thumb only by luck, it can only ever be as wide as
 * the video box, and it has to compete with the very controls it configures. A
 * sheet comes up to the thumb instead, is as wide as the screen, and — because
 * it is a `Modal` — **cannot contain the video**. That last part is the whole
 * architecture in one sentence: `<Video>` stays exactly where it is, mounted in
 * the surface, and the chrome that needs a window borrows one.
 *
 * ## How the animation is sequenced
 *
 * `Modal`'s own `animationType` slides its entire subtree, backdrop included —
 * which reads as a black bar rising over the app rather than a panel arriving
 * over a dimmed one. So the Modal is mounted `none` and both halves are driven
 * from a single `progress` value:
 *
 *  - the backdrop fades in with it;
 *  - the panel rides `translateY = height → 0` with it.
 *
 * The panel's own height is the slide distance, and it is unknown until it has
 * laid out. Rather than show the panel in place for a frame and then yank it
 * down, **nothing starts until `onLayout` reports a real height**: `progress`
 * sits at 0, and at 0 both the opacity and the backdrop are 0, so the panel is
 * invisible-but-mounted. That also means the first animation always slides the
 * *current* content, not the previous page's height.
 *
 * Closing runs the same value backwards and only unmounts when the timing
 * finishes — a sheet that vanished on the state change would never be seen to
 * leave.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from '@/components/icons'

import { colors, fonts, radii, spacing } from '@/theme'

/**
 * Sheet corners are a deliberate local deviation. Every panel on the page is
 * square (`radii.md` is 1.6, which is a rounding error, not a curve) because
 * the design language is orthogonal; a bottom sheet that arrives from the
 * screen edge is a different object — it is a surface, not a frame — and a
 * hard top corner makes it look cropped rather than presented. Fourteen px is
 * the Android bottom-sheet convention and the smallest radius that still reads
 * as a curve at 1×.
 */
const SHEET_RADIUS = 14
const OPEN_MS = 260
const CLOSE_MS = 200
/**
 * How dark the picture behind gets — as a **ramp**, not a panel.
 *
 * It used to be one flat `0.62` across the whole window, which turned every
 * frame above the sheet into a single grey wash: on a tall portrait screen the
 * panel owns the bottom 64%, so the remaining third-to-half of the picture
 * looked like a 50% black rectangle laid over it. That reads as a rendering
 * bug rather than as depth, and it is exactly the "opaque panel" the redesign
 * banned everywhere else (§17, where `Scrim` is the gradient it replaced).
 *
 * So the dim is bought only where it earns something: the top of the screen
 * keeps nearly all of the picture, and the ramp arrives at `BACKDROP_EDGE` by
 * the time it reaches the sheet's own top edge — which is the only place a
 * viewer needs the sheet to read as *on top of* the video.
 */
const BACKDROP_TOP = 0.12
const BACKDROP_EDGE = 0.56

export interface SheetProps {
  visible: boolean
  /** Screen-reader heading; also the visible title above the rows. */
  title: string
  onClose: () => void
  /**
   * Android back. Omitted means "close". The settings sheet passes its own so
   * back walks one level up the tree first — and because this is a `Modal`,
   * it gets the key rather than the player's `BackHandler`, which is exactly
   * the priority the old popover had to register a listener to win.
   */
  onBack?: () => void
  children: ReactNode
}

export function Sheet({ visible, title, onClose, onBack, children }: SheetProps) {
  const insets = useSafeAreaInsets()
  /**
   * 0 = closed, 1 = fully in place. One value drives both halves so the panel
   * and the dim behind it can never disagree about where the sheet is.
   */
  const progress = useRef(new Animated.Value(0)).current
  /** Kept outside React so the close effect can see a mount it already owns. */
  const mountedRef = useRef(false)
  const startedRef = useRef(false)
  const [mounted, setMounted] = useState(false)
  /** The slide distance, and the signal that the first open may begin. */
  const [panelHeight, setPanelHeight] = useState(0)
  /**
   * The window's own height. The ramp has to reach full dark exactly where the
   * panel's top edge lands, and that edge moves with every page of the sheet —
   * a two-row menu and a full episode list need the same contrast at the seam,
   * so it is measured rather than guessed.
   */
  const [backdropHeight, setBackdropHeight] = useState(0)
  /**
   * …and the window's width, for the same reason `Scrim` measures instead of
   * writing `width="100%"`: a percentage on `<Svg>` is resolved against a
   * viewport `react-native-svg` does not necessarily revisit, so a backdrop
   * that mounted in portrait would keep painting a portrait-wide strip after a
   * rotation — a hard vertical edge with dark on one side only. The stops are
   * all offsets, so nothing else about the ramp depends on these numbers.
   */
  const [backdropWidth, setBackdropWidth] = useState(0)
  /** Sanitised because React 19's `useId` returns `«r0»`, illegal in `url(#…)`. */
  const gradientId = `sheetdim${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    if (visible) {
      progress.setValue(0)
      setPanelHeight(0)
      startedRef.current = false
      mountedRef.current = true
      setMounted(true)
      return
    }
    if (!mountedRef.current) return
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (finished) {
        mountedRef.current = false
        setMounted(false)
      }
    })
  }, [progress, visible])

  const handleLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    const height = event.nativeEvent.layout.height
    if (height <= 0 || height === panelHeight) return
    setPanelHeight(height)
    if (startedRef.current || !visible) return
    startedRef.current = true
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_MS,
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }

  // `0 → OPEN`. Height is 0 on the first render, at which point both outputs
  // collapse to "in place, fully transparent" — invisible rather than flashed.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [panelHeight, 0] })
  const panelOpacity = progress
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
  /**
   * The offset at which the ramp has arrived at `BACKDROP_EDGE`, clamped so a
   * half-measured layout can never invert the gradient or collapse it to a
   * single point. Before both heights are known it falls back to `1`, which is
   * a plain top-to-bottom ramp — and `progress` is 0 at that moment anyway, so
   * nothing is visible while the two settle.
   */
  const darkAt =
    backdropHeight > 0 && panelHeight > 0
      ? Math.min(0.95, Math.max(0.15, (backdropHeight - panelHeight) / backdropHeight))
      : 1

  if (!mounted) return null

  return (
    <Modal
      animationType="none"
      onRequestClose={() => (onBack ?? onClose)()}
      statusBarTranslucent
      transparent
      visible>
      <Animated.View
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout
          setBackdropHeight(height)
          setBackdropWidth(width)
        }}
        style={[styles.backdrop, { opacity: backdropOpacity }]}>
        {/*
          Nothing is visible yet at this point — `progress` is 0 until the panel
          reports its own layout — so waiting one frame for the measurement
          costs nothing, and the key remounts the view whenever the window
          changes shape rather than asking a measured one to reconsider.
        */}
        {backdropWidth > 0 && backdropHeight > 0 ? (
          <Svg
            key={`${backdropWidth}x${backdropHeight}`}
            height={backdropHeight}
            pointerEvents="none"
            width={backdropWidth}>
            <Defs>
              <LinearGradient id={gradientId} x1={0} x2={0} y1={0} y2={1}>
                <Stop offset="0" stopColor="#000000" stopOpacity={BACKDROP_TOP} />
                <Stop offset={String(darkAt)} stopColor="#000000" stopOpacity={BACKDROP_EDGE} />
                <Stop offset="1" stopColor="#000000" stopOpacity={BACKDROP_EDGE} />
              </LinearGradient>
            </Defs>
            <Rect
              fill={`url(#${gradientId})`}
              height={backdropHeight}
              width={backdropWidth}
              x={0}
              y={0}
            />
          </Svg>
        ) : null}
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        onLayout={handleLayout}
        style={[
          styles.panel,
          {
            opacity: panelOpacity,
            paddingBottom: insets.bottom + spacing.lg,
            transform: [{ translateY }],
          },
        ]}>
        <View accessibilityElementsHidden importantForAccessibility="no" style={styles.grabber} />

        <View style={styles.header}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
            <X color={colors.mutedForeground} size={16} strokeWidth={1.6} />
          </Pressable>
        </View>

        {/*
          `flexGrow: 0` / `flexShrink: 1`: the sheet is as tall as its content
          up to the panel's 82% cap, and only past that does it scroll. A sheet
          that always filled the screen would look the same whether it held two
          rows or twelve, which is the one thing a sheet should be telling you
          at a glance — and `flexShrink` is what turns the cap into a scroll
          viewport instead of letting the rows run under the rounded top edge.
        */}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.body}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    /**
     * Deliberately no `backgroundColor`: the gradient `<Rect>` above is the
     * whole backdrop. A flat fill left behind as a fallback would multiply
     * with `opacity` and, now that opacity runs to 1, paint the window solid.
     */
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    /** Clips the rows to the rounded top edge as they scroll under it. */
    overflow: 'hidden',
  },
  /** The pill that says "this thing slides". Pure affordance, so it is silent. */
  grabber: {
    alignSelf: 'center',
    width: 34,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.input,
    marginTop: spacing.s1_5,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11.2,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  /** 32 px of icon inside a 44 px pressable: the target, not the glyph, is the button. */
  close: {
    width: 44,
    height: 44,
    marginRight: -spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.badge,
  },
  closePressed: { backgroundColor: colors.secondary },
  body: { flexGrow: 0, flexShrink: 1 },
})
