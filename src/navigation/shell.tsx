/**
 * Shell navigation context.
 *
 * The web's `<header>` and `<BottomNav>` are siblings of the router outlet,
 * not children of a route — they exist exactly once and never unmount. To get
 * the same on RN, they have to live *outside* `Stack.Navigator`, where
 * `useNavigation()` is unavailable (it needs a navigator's context).
 *
 * So `AppShell` reads the container's own navigation object from
 * `NavigationContainerRefContext` and publishes two things down: the focused
 * route name (for the active tab) and a `navigate` that dispatches
 * `CommonActions.navigate`.
 *
 * Deliberately **not** `useNavigationContainerRef()`: that hook hands back a
 * brand-new, unwired ref whose `current` stays `null` unless you pass it as
 * `<NavigationContainer ref={...}>`. On an unwired ref every method either
 * returns `undefined` or logs `NOT_INITIALIZED_ERROR`, so navigation silently
 * does nothing — which is exactly how this was first diagnosed.
 *
 * The context object is memoised once (every value it closes over is a
 * `useLatestCallback`/`useCallback([])`), so the subscription below runs once.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { CommonActions, NavigationContainerRefContext } from '@react-navigation/native'
import type { NavigationContainerRef } from '@react-navigation/native'

import type { RootRouteName, RootStackParamList } from './types'

export interface ShellNav {
  /** Topmost route name — `undefined` before the first state lands. */
  activeRoute: string | undefined
  navigate: (name: RootRouteName, params?: RootStackParamList[RootRouteName]) => void
}

const FALLBACK: ShellNav = { activeRoute: undefined, navigate: () => undefined }

const ShellNavContext = createContext<ShellNav>(FALLBACK)

export function useShellNav(): ShellNav {
  return useContext(ShellNavContext)
}

export function ShellNavProvider({ children }: { children: React.ReactNode }) {
  const container = useContext(NavigationContainerRefContext)
  const [activeRoute, setActiveRoute] = useState<string | undefined>(() => readRoute(container))

  useEffect(() => {
    if (!container) return
    const sync = () => setActiveRoute(readRoute(container))
    sync()
    return container.addListener('state', sync)
  }, [container])

  const value = useMemo<ShellNav>(
    () => ({
      activeRoute,
      navigate: (name, params) => {
        if (!container) return
        // String form, not `navigate({ name, params })`: the object overload is
        // deprecated in v7 and warns on every call ("Open debugger to view
        // warnings" toast). The produced action is identical for our routes —
        // `payload.params` reads as `undefined` either way.
        container.dispatch(CommonActions.navigate(name, params))
      },
    }),
    [activeRoute, container],
  )

  return <ShellNavContext.Provider value={value}>{children}</ShellNavContext.Provider>
}

/** Structurally identical to `ParamListBase`, without pulling in `@react-navigation/routers`. */
type ContainerRef = NavigationContainerRef<Record<string, object | undefined>>

function readRoute(container: ContainerRef | undefined): string | undefined {
  return container?.isReady() ? container.getCurrentRoute()?.name : undefined
}
