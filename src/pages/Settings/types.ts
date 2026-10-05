/**
 * Types shared by the Settings page and its panels.
 *
 * The page is only a shell now — every group of rows lives in its own panel
 * under `panels/`, and these are the few names they all need.
 */
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import type { RootStackParamList } from '@/navigation/types'

/**
 * Every action that destroys something and therefore has to be confirmed.
 * The dialog's wording and the message shown afterwards both hang off this
 * union, so adding an action here is enough to make it appear correctly.
 */
export type ConfirmAction =
  | 'history'
  | 'myList'
  | 'recent'
  | 'cache'
  | 'extensions'
  | 'reset'

/** Navigation for the panels that push a screen (History, My List, …). */
export type SettingsNav = NativeStackNavigationProp<RootStackParamList>