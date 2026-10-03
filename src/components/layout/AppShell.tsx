/**
 * `AppShell` — the RN stand-in for `pixiWeb/src/components/layout/RootLayout`.
 *
 * Same three-part column the web has: persistent header, the route outlet,
 * and the fixed bottom nav, with the whole thing inside one
 * `NavigationContainer` so `ShellNavProvider` can observe the focused route.
 *
 * What `RootLayout` also does that the web doesn't need here:
 *  - `ScrollRestoration` → handled per-screen by `ScreenLayout`'s
 *    `useScrollToTop`;
 *  - the skip-link (`<a href="#main">`) → RN has no tab order;
 *  - `usePixiHealthLoop` + `<PixiOfflineDialog>` → there is no bridge.
 */
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { BottomNav } from './BottomNav'
import { FullscreenChromeProvider, useIsFullscreen } from './FullscreenChrome'
import { Header } from './Header'
import { ShellNavProvider } from '@/navigation/shell'
import { colors } from '@/theme'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <FullscreenChromeProvider>
      <ShellNavProvider>
        <ShellColumn>{children}</ShellColumn>
      </ShellNavProvider>
    </FullscreenChromeProvider>
  )
}

/**
 * The three-part column, minus whatever a fullscreen screen has claimed.
 *
 * `<Header>`/`<BottomNav>` are unmounted rather than hidden: they are siblings
 * of the outlet, so nothing inside a promoted screen depends on them, and the
 * status-bar inset goes with them so the video really owns the window.
 */
function ShellColumn({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const fullscreen = useIsFullscreen()

  return (
    <View style={[styles.column, fullscreen ? null : { paddingTop: insets.top }]}>
      {fullscreen ? null : <Header />}
      <View style={styles.outlet}>{children}</View>
      {fullscreen ? null : <BottomNav />}
    </View>
  )
}

const styles = StyleSheet.create({
  column: { flex: 1, backgroundColor: colors.background },
  outlet: { flex: 1, minHeight: 0 },
})
