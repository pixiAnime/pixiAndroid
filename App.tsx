/**
 * App shell — React Navigation wrapped in the ported pixiWeb chrome.
 *
 * `RootLayout` on the web is one persistent column (sticky header, scrolling
 * `<main>`, footer, fixed bottom nav) around every route. The RN equivalent
 * is `AppShell` inside `NavigationContainer`: the header and bottom nav are
 * siblings of the navigator outlet so they never remount between routes,
 * and each screen supplies its own scrolling body through `ScreenLayout`.
 *
 * The query provider sits above everything, exactly as `main.tsx` does on
 * the web — `queryClient` (and its `localStorage`-backed persister) is the
 * same instance the shared hooks expect.
 *
 * @format
 */
import { StatusBar } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AppShell } from '@/components/layout'
import { queryClient } from '@/lib/queryClient'
import { RootNavigator } from '@/navigation/RootNavigator'
import { navigationTheme } from '@/navigation/theme'
import { colors } from '@/theme'

// Bootstraps the i18next singleton (the web does this in `main.tsx`).
import '@/i18n'

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={colors.background} />
          <NavigationContainer theme={navigationTheme}>
            <AppShell>
              <RootNavigator />
            </AppShell>
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

const styles = { root: { flex: 1, backgroundColor: colors.background } }

export default App
