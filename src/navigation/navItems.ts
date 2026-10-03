/**
 * Primary navigation — shared by the header and the mobile bottom bar.
 * Exactly 4 items; History / My List / Extensions live in Settings instead.
 * Labels are i18n keys resolved by the consuming component.
 *
 * Mirrors `pixiWeb/src/components/layout/nav-items.ts`, with `to` (the web
 * path) kept alongside `screen` so the two stay obviously in step.
 */
import { Home, Search, Settings, SquareStack } from 'lucide-react-native'
import type { ComponentType } from 'react'

import type { RootRouteName } from './types'

export interface NavItem {
  /** Web path — documentation and parity checks only. */
  to: string
  screen: RootRouteName
  labelKey: string
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', screen: 'Home', labelKey: 'nav.home', icon: Home },
  { to: '/browse', screen: 'Browse', labelKey: 'nav.browse', icon: SquareStack },
  { to: '/search', screen: 'Search', labelKey: 'nav.search', icon: Search },
  { to: '/settings', screen: 'Settings', labelKey: 'nav.settings', icon: Settings },
]

/** Secondary destinations reachable from the footer / Settings list. */
export const SECONDARY_NAV: { to: string; screen: RootRouteName; labelKey: string }[] = [
  { to: '/history', screen: 'History', labelKey: 'nav.history' },
  { to: '/my-list', screen: 'MyList', labelKey: 'nav.myList' },
  { to: '/extensions', screen: 'Extensions', labelKey: 'nav.extensions' },
]
