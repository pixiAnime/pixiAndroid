/**
 * Root navigator — one native stack covering every web route.
 *
 * There is no separate tab navigator: the four bottom-nav destinations are
 * ordinary stack screens, which is exactly how the web treats them (each is
 * a URL, and pushing a detail screen on top of one leaves the tab bar with
 * nothing highlighted). Android's hardware back pops the stack, which is the
 * behaviour users expect and the web has no equivalent for.
 *
 * ## Motion
 *
 * Page changes follow Material 3's transition patterns instead of the one
 * full-width, iOS-style slide every route used to share:
 *
 * | routes | option | M3 pattern | looks like |
 * |--------|--------|------------|-------------|
 * | top-level destinations (what the bottom nav switches between) | `FADE_THROUGH` | **fade through** | switching tabs in the Play Store / YouTube |
 * | details pushed on top (`AnimeDetail`, `Watch`) | `SHARED_AXIS_X` | **shared axis, X** | opening an app page in the Play Store |
 *
 * Both directions resolve correctly without special-casing, because
 * react-native-screens reads the option off the screen being *pushed* for a
 * push and off the screen being *dismissed* for a pop (`ScreenStack.kt` →
 * `stackAnimation = …`): backing out of a detail plays that detail's shared
 * axis in reverse.
 *
 * The option only picks *which* Android `anim` runs — the curves (300ms,
 * emphasized easing, no dead frame before the arriving screen shows) live in
 * `android/app/src/main/res/anim/`, whose files override react-native-screens'
 * stock ones of the same names. `animationDuration` would be the other knob,
 * but it is iOS-only and this app has no iOS target.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

import type { RootStackParamList } from './types'

import { colors } from '@/theme'

import { HomePage } from '@/pages/Home'
import { BrowsePage } from '@/pages/Browse'
import { SearchPage } from '@/pages/Search'
import { AnimeDetailsPage } from '@/pages/AnimeDetails'
import { WatchPage } from '@/pages/Watch'
import { HistoryPage } from '@/pages/History'
import { MyListPage } from '@/pages/MyList'
import { ExtensionsPage } from '@/pages/Extensions'
import { SettingsPage } from '@/pages/Settings'
import { NotFoundPage } from '@/pages/NotFound'

const Stack = createNativeStackNavigator<RootStackParamList>()

type ScreenAnimation = NonNullable<NativeStackNavigationOptions['animation']>

/**
 * M3 **fade through** — the default, and the right motion between peer
 * destinations: two screens that are not visually related fade through each
 * other instead of sliding sideways.
 */
const FADE_THROUGH: ScreenAnimation = 'fade'

/**
 * M3 **shared axis (X)** — for screens pushed deeper into the hierarchy.
 *
 * Carried by `slide_from_right`, which react-native-screens maps onto
 * `res/anim/rns_slide_*.xml`; those four are overridden in
 * `android/app/src/main/res/anim/` with Material's spec — a 30dp shift plus a
 * fade-through over 300ms — because the stock ones are a 100%-wide iOS slide.
 */
const SHARED_AXIS_X: ScreenAnimation = 'slide_from_right'

export function RootNavigator() {
  const screens: {
    name: keyof RootStackParamList
    component: React.ComponentType<object>
    /** Defaults to `FADE_THROUGH`; only screens pushed *onto* another one set it. */
    animation?: ScreenAnimation
  }[] = [
    { name: 'Home', component: HomePage },
    { name: 'Browse', component: BrowsePage },
    { name: 'Search', component: SearchPage },
    { name: 'AnimeDetail', component: AnimeDetailsPage, animation: SHARED_AXIS_X },
    { name: 'Watch', component: WatchPage, animation: SHARED_AXIS_X },
    { name: 'History', component: HistoryPage },
    { name: 'MyList', component: MyListPage },
    { name: 'Extensions', component: ExtensionsPage },
    { name: 'Settings', component: SettingsPage },
    { name: 'NotFound', component: NotFoundPage },
  ]

  if (__DEV__) {
    // Lazy require so the spike harness is never in a release bundle.
    const { DevScreen } = require('@/dev/DevScreen') as typeof import('@/dev/DevScreen')
    screens.push({ name: 'Dev', component: DevScreen })
  }

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}>
      {screens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{ animation: screen.animation ?? FADE_THROUGH }}
        />
      ))}
    </Stack.Navigator>
  )
}
