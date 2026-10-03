/**
 * Root navigator — one native stack covering every web route.
 *
 * There is no separate tab navigator: the four bottom-nav destinations are
 * ordinary stack screens, which is exactly how the web treats them (each is
 * a URL, and pushing a detail screen on top of one leaves the tab bar with
 * nothing highlighted). Android's hardware back pops the stack, which is the
 * behaviour users expect and the web has no equivalent for.
 */
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import type { RootStackParamList } from './types'

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

export function RootNavigator() {
  const screens: { name: keyof RootStackParamList; component: React.ComponentType<object> }[] = [
    { name: 'Home', component: HomePage },
    { name: 'Browse', component: BrowsePage },
    { name: 'Search', component: SearchPage },
    { name: 'AnimeDetail', component: AnimeDetailsPage },
    { name: 'Watch', component: WatchPage },
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
        contentStyle: { backgroundColor: '#0a0a0a' },
        animation: 'slide_from_right',
      }}>
      {screens.map((screen) => (
        <Stack.Screen key={screen.name} name={screen.name} component={screen.component} />
      ))}
    </Stack.Navigator>
  )
}
