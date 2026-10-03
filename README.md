# pixiAndroid

The native counterpart to [pixiWeb](../pixiWeb) — a React Native (bare,
TypeScript) Android client that reproduces the web app's design, UX,
structure, business logic and **extension ecosystem**, without a WebView and
without the `PixiClient` bridge.

## What "counterpart" means here

The same extension URL installs and runs unchanged on web and Android:

- **No mobile-only extension API.** Every extension is a self-contained ESM
  module with `default export`, evaluated against the identical manifest and
  `context` contract (`context.http.*`, `context.logger`, `context.utils`,
  `getSources` / `getSubtitles`, API version `"1"`).
- **Shared core is synced, not forked.** `scripts/sync-shared.mjs` copies 52
  files byte-for-byte from `../pixiWeb` (3 of them with an `import.meta.env`
  → `__DEV__` transform) and `npm run sync:check` fails the build on drift.
  Platform-specific files are owned by each project and sit behind the
  interfaces described below.
- **pixiWeb is never written to.** Everything flowing the other way is a read.

## Architecture

```
src/
  theme/               design tokens + text presets (single visual source)
  navigation/          route table, shell dispatcher, RN theme
  components/
    layout/            AppShell, Header, BottomNav, Footer, ScreenLayout
    anime/             cards, sections, hero, badges, safe image
    states/            ErrorState / EmptyState / skeletons (web API parity)
    ui/                Button, Input, Dialog, SelectField, Badge, Chip
  pages/               the 10 routes, ported from ../pixiWeb/src/pages
  api/                 Jikan + AniList clients (mobile-owned transport)
  platform/            platform layer (Android-owned)
    quickjs/           native sandbox facade
      types.ts           wire types + envelope parsing
      native.ts          typed accessor for the PixiSandbox native module
      bootstrap.ts       the script evaluated INSIDE QuickJS
      sandboxScripts.ts  composes locale prelude + URL polyfill + bootstrap
      PixiSandbox.ts     create/evaluate/call/dispose + event routing
      generated/         build outputs (URL polyfill bundle)
    storage/           MMKV-backed `localStorage` for shared stores
    urlPolyfill.ts     installs the WHATWG URL globals RN lacks
    fullscreen.ts      orientation lock + system bars for player fullscreen
  extensions/runtime/  extension runtime (mirror of the web's, mobile-owned
                       where the platform differs: ExtensionSandbox, http,
                       ExtensionLoader)
  extensions/storage/  installed records (MMKV, replaces IndexedDB)
  extensions/player/   playback adapter (passthrough — ExoPlayer sets headers)
  stores|hooks|providers  synced from the web (part of the 52 shared files)
  dev/                 DevScreen: sandbox + player spike tabs (device only)
native/                vendored quickjs-ng + platform-neutral sandbox core
android/pixiquickjs/   Android library module: JNI glue + Kotlin bridge
android/app/…/fullscreen/  orientation + system bars (the player's fullscreen)
```

### The persistent shell

On the web, `<header>` and `<BottomNav>` are siblings of the router outlet and
exist exactly once; on RN the analogous structure is chrome rendered *outside*
`Stack.Navigator`. `NavigationContainer → AppShell(Header, outlet, BottomNav)`
gives the same shape, so a tab press never mounts or unmounts the chrome and
`useScrollToTop` in `ScreenLayout` still restores scroll on route change.

Chrome lives outside any navigator, where `useNavigation()` is unavailable —
so `ShellNavProvider` (`src/navigation/shell.tsx`) reads the container's own
navigation object from `NavigationContainerRefContext` and publishes the
focused route plus a `navigate` down the tree.

> **`useNavigationContainerRef()` is a trap here.** It hands back a fresh,
> *unwired* ref whose `current` stays `null` until you pass it as
> `<NavigationContainer ref={…}>`. Every method on such a ref silently returns
> `undefined` or logs `NOT_INITIALIZED_ERROR`, so taps appear to do nothing
> with no JS error. That is exactly how navigation was first diagnosed as
> "broken" on device.

### The sandbox

One `JSRuntime` per extension, all on a single dedicated worker thread with a
global task queue. There is **no React Native C++ dependency, no codegen and
no prefab**: the C++ core up-calls three `@JvmStatic` Kotlin methods
(`onResult` / `onHostRequest` / `onLog`), and promises live in a Kotlin
`ConcurrentHashMap` keyed by an `opId`.

Boot is two evaluations:

1. a **global script** — locale prelude, bundled WHATWG `URL` polyfill, then
   the bootstrap that denies every network primitive (`fetch`, `XMLHttpRequest`,
   `WebSocket`, `importScripts`, …), wires `console` to the host and defines
   `__pixiBoot` / `__pixiCall` / `__pixiTakeOutcome` / `__pixiHttpResult`;
2. an **ES module** — `import * as pixiModule from 'pixi:extension'`, served
   verbatim by the engine's module loader. Extension source is never
   interpolated into a string, so arbitrary text cannot escape the sandbox.

Security and liveness are enforced on both sides:

- host-side deadlines (the worker wakes at the earliest deadline, rejects, and
  recycles the context — a wedged extension can never stall the app);
- engine-side limits (`JS_SetInterruptHandler` abort, 192 MB memory, 512 KB
  stack);
- `context.http` is an RPC to the **shared** `policy.ts` layer, which owns URL
  validation, header/body sanitation, size caps and timeouts. The sandbox sees
  plain text back — it never touches a socket.

### The player

`react-native-video` (ExoPlayer) plus controls rebuilt in RN, because the web
gets them from Vidstack's `DefaultVideoLayout`: play/pause/replay, a scrubbing
bar, skip ±10 s, a settings menu, mute, fullscreen, the captions menu and the
subtitle-sync chip. Container subtitles (`#EXT-X-MEDIA`, muxed MP4) are selected
by index and rendered by ExoPlayer; side-loaded tracks are drawn as an RN cue
overlay from pure TS timing. Chrome words come from
`src/pages/Watch/playerWords.ts`, which reuses the web `layout-words` entries
(`Speed`, `Mute`, `Unmute`, `Settings`, `Seek Backward`/`Seek Forward`,
`Enter/Exit Fullscreen`) verbatim; `Display` / `Fit` / `Fill`, the three cue
sizes, `Auto next episode` and `On` are new, because Vidstack has no word for
them and a phone does need them.

The **settings menu** is a tree, not a list. One flat panel of speed, display,
cue size, nine subtitle tracks, delay, skip, hold speed and autoplay is ~30
rows to scroll past — a wall, not a menu. So the gear opens a summary list and
every value is two taps from it:

```
⚙ Settings
  Playback    1× · Fit        ›
  Subtitles   Arabic · Medium ›
      Playback  → Speed · Display · Skip · Hold speed · Auto next
      Subtitles → Track · Size · Delay
```

Each summary row shows what it is set to right now, and picking a value steps
back to the list that owns it. Two things stay flat on their summary page on
purpose: autoplay, because a two-row list whose rows are each other is a worse
way of saying yes or no, and the delay stepper, which is a control rather than
a list. The shape lives in `settingsMenu.ts` (`parentPage`, `pageDepth`,
`groupOf`) with tests asserting that every page has a parent, every chain ends
at the root and nothing is more than two taps deep — a typo in a page name
would otherwise strand a screen with no way out of it. Android's back key walks
the tree before it closes the menu.

What it configures: speed (0.5×–2×), display (fit/fill), cue size (applied to
*both* ways subtitles are drawn — see `subtitleScale`), subtitle track and
delay, skip distance (5/10/15/30 s — the buttons, the double-tap gesture and
its flash all follow it), the hold rate (1.5×/2×/3×), a sleep timer and
autoplay of the next episode; all but speed, fit and the sleep timer persist in
MMKV. The web's captions chip and
sync chip are gone from the corner: on a phone that corner is where the system
bars and the cutout are, and one gear that owns everything beats three floating
targets. The pages scroll inside a surface that is only 16:9 in portrait,
bounded by the surface's *measured* height — a percentage `maxHeight` resolves
against an indefinite parent and the list would render past its panel and be
clipped rather than scrollable.

Three of those are **react-native-video** capabilities the web has no
equivalent for, and each is hidden when it does not apply:

- **Audio** — `onAudioTracks` + `selectedAudioTrack`
  (`SelectedTrackType.INDEX`). Most providers send a single audio track, so the
  row is rendered only when there is a real second choice rather than a list of
  one.
- **Sleep timer** — off / 5 / 10 / 15 / 30 / 45 min, held as a *deadline*
  (`sleepAt`) rather than a countdown, so reopening the menu cannot extend it;
  a 30 s tick is all that keeps the row's remaining time honest. Firing it is
  the ordinary pause path (`setUserPaused(true)`).
- **Picture-in-picture** — a bar button, not a setting, because it is an
  action. `enterPictureInPicture()` / `exitPictureInPicture()` plus
  `onPictureInPictureStatusChanged`, so the icon follows Android dismissing the
  window too and not just our own taps. It needs
  `android:supportsPictureInPicture="true"` on the activity; **the
  `Medium_Phone` AVD (API 24, no Play images) does not advertise
  `android.software.picture_in_picture` and silently ignores the request**, so
  this is the one control that can only be confirmed on a real device or a
  Google Play API 26+ image.

**Gestures** on the picture are YouTube's set: single tap plays/pauses, a
double tap on either half seeks ±10 s (with a "seek backward/forward" flash), a
press and hold runs at 2× for as long as the finger is down. The arbitration is
a pure state machine (`src/pages/Watch/tapGestures.ts`, 12 unit tests) and the
component only translates its two timers into events. Two things it exists to
pin down, both found on device:

> **The tap window opens on release, not on press.** Armed from `down`, a
> 280 ms window expires under a one-second press and the hold threshold never
> fires — every long press resolved as a play/pause instead. `up` is what arms
> the window; `down` arms only the hold.

> **"Arm nothing" is not "clear everything".** The step's `timers` field is the
> set that should be *running* after the transition, so `up` on a pending tap
> keeps the window and drops the hold. A component that reads `false` as
> "clear" silently kills the tap.

**Fullscreen** is a promotion, not a re-parent: the surface keeps its place in
the tree and only changes shape, the page collapses around it (`display: none`,
so the body's scroll offset survives) and `AppShell` drops its header and tab
bar. Two things JS cannot do come from `PixiFullscreen`, a ~90-line Kotlin
module (`android/app/src/main/java/com/pixi/mobile/fullscreen`) reached through
`src/platform/fullscreen.ts` — the app's second native module after the sandbox:
latch the activity's orientation and force
`SCREEN_ORIENTATION_SENSOR_LANDSCAPE` (restored on exit), and hide the system
bars. Measured on device: the frame is a true 2400×1080 with playback
continuous through the transition (no black frame, no re-prepare), and the
back button leaves fullscreen before it leaves the page.

> **A `Modal` is the obvious way to do this and it is the wrong one.** Two
> traps, both found by measuring pixels: RNV's own `fullscreen` prop hands the
> player to a native `FullScreenPlayerView` in a separate window where these
> overlay controls, the cue box and the chosen text track do not exist; and
> re-parenting our own tree into a `Modal` destroys the native video view, so
> every toggle re-prepared the stream and arrived as a visible reload.
>
> **React Native's insets do not fix the navigation bar.** A `Modal` window is
> laid out edge to edge; its root only sets `fitsSystemWindows` when
> `statusBarTranslucent` is off, and even then the wrapper's DecorView has
> already consumed the insets, and `useSafeAreaInsets()` reports zeros inside
> the dialog. So the nav bar — a *side* one in landscape — drew straight over
> the rightmost controls. Hiding it (immersive; a swipe from the edge brings it
> back) is what a video player is supposed to do, and it makes the frame
> genuinely full-bleed. The same window is also why the shell hides its chrome
> rather than the modal covering it.

### Why no bridge

pixiWeb routes every extension request and every HLS playlist rewrite through
`PixiClient` on `127.0.0.1:8765`, because a browser cannot send arbitrary
headers and CORS blocks direct media fetches. Android has neither constraint:

| web needs the bridge for                | Android equivalent                          |
| --------------------------------------- | ------------------------------------------- |
| extension HTTP with `Referer`/`UA`      | direct `fetch` through the policy layer     |
| HLS playlist rewriting for headered URL | ExoPlayer applies headers to segments       |
| Range-preserving media proxy            | native player does Range natively           |
| IndexedDB for extension records         | MMKV                                         |

One asymmetry runs the other way. A browser sniffs the bytes it receives;
react-native-video picks ExoPlayer's `MediaSource` from the **URL's path**
(`Util.inferContentType` over `uri.getLastPathSegment()`). A provider that
serves HLS behind an endpoint like `/proxy?url=…master.m3u8` therefore resolves
to a generic file, and the extractors fail on `#EXTM3U` with
`ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED` — a stream the web plays happily.
`playbackAdapter.playbackContentType` forwards the provider's declared type as
RNV's `source.type`, but only when the path doesn't already name the container,
so a URL ending in `.m3u8` / `.mpd` keeps inferring exactly as it did before.

**When a provider's CDN is down, no client can save it.** Diagnosed on the
emulator with the `ayruki-auto` HLS source: ExoPlayer reached
`HttpDataSource$InvalidResponseCodeException: Response code: 502` on a *media
segment* while the master and the variant playlist (same host, same headers)
returned 200 — and the origin itself answered 403 to a direct request. A 502
from the segment host is upstream, not the app. What the app can do is not give
up on the first hiccup: the source sets `minLoadRetryCount: 3`, so ExoPlayer
retries a transient failure with its own backoff and the viewer never sees it,
while a genuinely dead stream still ends in the error overlay with **Try
again**.

`PIXICLIENT_UNAVAILABLE` / `PIXICLIENT_ERROR` stay in the shared error
taxonomy for compatibility, but are unreachable here.

Because the i18n resources are part of the synced shared core, a few strings
still use the web's wording — "make every network request through pixiClient",
"stored in this browser", "Local bridging by pixiClient". They are byte-equal
to what pixiWeb renders by design; only bridge-specific *chrome* was dropped
(ConnectionIndicator, the footer bridge label, the "Playback via pixiClient"
settings row, the offline banner in Extensions). Rewording them would mean
diverging a synced file, so it is a deliberate trade rather than an oversight.

## Commands

```bash
npm run sync:check     # shared files still byte-identical to ../pixiWeb
npm run polyfills:check
npm run fixtures:check # bundled extension fixtures still match the corpus
npm run typecheck
npm test               # node --test
npm run compat         # extension corpus + runtime contract parity
npm run verify         # everything above (lint included)

npm run build:debug    # from ./android: JAVA_HOME=/usr/lib/jvm/java-17-openjdk
```

## Verification

- **`npm run compat`** statically proves every extension in
  `../pixiWeb/extensions` evaluates as self-contained ESM, exports a valid
  manifest, declares a supported `apiVersion`, and that the mobile bootstrap's
  error-code vocabulary and shared envelope copy match the web's.
- **`src/dev/sandboxSpike.ts`** (dev screen, needs a device/emulator) boots
  those same six production extensions *unmodified* inside QuickJS and checks
  real `context.http`, method calls, deadline kills, runtime recycling,
  structured errors, `console` routing and disposal.
- **On-device smoke test** (emulator `emulator-5554`, API 24): all 10 routes
  render and navigate — Home, Browse, Search, Settings, AnimeDetail, Watch,
  History, MyList, Extensions — through the shell dispatcher, with no JS
  errors and no `NOT_INITIALIZED_ERROR`. Long-press the `π` mark for `Dev`,
  which hosts the sandbox and player spikes above.
- **Player, on device**: HLS-via-proxy and direct-MP4 both play (see the
  container asymmetry and the upstream-`502` note below); fullscreen rotates
  the device, clears the system bars and keeps playback **continuous** — the
  frame measures a true 2400×1080 0.4 s after the toggle with no reload frame,
  because the surface is promoted in place instead of being re-parented.
  Double-tap seeks the configured distance (the flash read `SEEK FORWARD 30S`
  after setting skip to 30 s), press-and-hold boosts to the configured rate
  (a visible `3×`) for exactly as long as the finger is down, `1.5×` advances
  16 s of content in 11 s of wall time, `Fill` centre-crops to the full screen,
  cue size, skip, hold speed and autoplay persist, and an episode that ends
  rolls into the next one.
