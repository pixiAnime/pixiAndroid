/**
 * "The player owns the screen" — the one piece of player state the app shell
 * has to know about.
 *
 * The web asks the *document* for fullscreen, which takes the header, the tab
 * bar and the page gutters with it. Android has no such thing, so fullscreen
 * here is a promotion: the surface changes from a 16:9 box in the page flow to
 * the whole window, and everything else in the column has to get out of the
 * way. That is shell state, not page state, so it is published from the shell
 * root and read by `AppShell`.
 *
 * It is deliberately **not** a `Modal`. Re-parenting the surface into one
 * destroys and recreates the native video view, so ExoPlayer re-prepares the
 * stream and fullscreen arrives as a visible reload. Promoting in place keeps
 * the player mounted, so entering and leaving are pure re-layout: no reload,
 * no lost buffer, and the position is never in question.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export interface FullscreenChrome {
  /** True while a screen is showing its content edge to edge. */
  fullscreen: boolean
  /** Claim (or release) the screen. */
  setFullscreen: (value: boolean) => void
}

/**
 * A default of "not fullscreen" rather than a throw: the provider is above the
 * navigator, but a component rendered outside it (a test, a future entry
 * point) must not be able to crash the app over chrome.
 */
const FALLBACK: FullscreenChrome = { fullscreen: false, setFullscreen: () => undefined }

const FullscreenChromeContext = createContext<FullscreenChrome>(FALLBACK)

export function FullscreenChromeProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false)
  const value = useMemo<FullscreenChrome>(() => ({ fullscreen, setFullscreen }), [fullscreen])
  return <FullscreenChromeContext.Provider value={value}>{children}</FullscreenChromeContext.Provider>
}

export function useFullscreenChrome(): FullscreenChrome {
  return useContext(FullscreenChromeContext)
}

/** Just the flag, for the screens that only need to collapse themselves. */
export function useIsFullscreen(): boolean {
  return useContext(FullscreenChromeContext).fullscreen
}
