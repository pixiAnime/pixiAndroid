/**
 * Primary navigation — shared by the header and the mobile bottom bar.
 * Exactly 4 items; History / My List / Extensions live in Settings instead.
 * Labels are i18n keys resolved by the consuming component.
 *
 * Mirrors `pixiWeb/src/components/layout/nav-items.ts`, with `to` (the web
 * path) kept alongside `screen` so the two stay obviously in step. `activeIcon`
 * is the one field the web has no use for: the bottom bar swaps outlined →
 * filled on the active destination, per Material 3's navigation bar (see
 * `./navIcons`), and the web's header draws no filled variants at all.
 */
import { Home, LayoutGrid, Search, Settings } from '@/components/icons'
import type { ComponentType } from 'react'

import { BrowseFilled, HomeFilled, SearchFilled, SettingsFilled } from './navIcons'
import type { RootRouteName } from './types'

export interface NavItem {
  /** Web path — documentation and parity checks only. */
  to: string
  screen: RootRouteName
  labelKey: string
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  /** Filled twin of `icon`, drawn while the destination is the active one. */
  activeIcon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', screen: 'Home', labelKey: 'nav.home', icon: Home, activeIcon: HomeFilled },
  { to: '/browse', screen: 'Browse', labelKey: 'nav.browse', icon: LayoutGrid, activeIcon: BrowseFilled },
  { to: '/search', screen: 'Search', labelKey: 'nav.search', icon: Search, activeIcon: SearchFilled },
  { to: '/settings', screen: 'Settings', labelKey: 'nav.settings', icon: Settings, activeIcon: SettingsFilled },
]

/** Secondary destinations reachable from the footer / Settings list. */
export const SECONDARY_NAV: { to: string; screen: RootRouteName; labelKey: string }[] = [
  { to: '/history', screen: 'History', labelKey: 'nav.history' },
  { to: '/my-list', screen: 'MyList', labelKey: 'nav.myList' },
  { to: '/extensions', screen: 'Extensions', labelKey: 'nav.extensions' },
]
