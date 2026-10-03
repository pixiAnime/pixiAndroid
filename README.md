<div align="center">

# pixiAndroid

**Your anime library, natively on Android.**
No WebView, no tab strip, no waiting — a fast extension-powered player that
resumes exactly where you left off.

[![Latest release](https://img.shields.io/github/v/release/pixiAnime/pixiAndroid?style=flat-square&label=release)](https://github.com/pixiAnime/pixiAndroid/releases)
![Android](https://img.shields.io/badge/Android-7.0%2B-3DDC84?style=flat-square&logo=android&logoColor=white)
![Size](https://img.shields.io/badge/APK-~61%20MB-e8830c?style=flat-square)

[Download](https://github.com/pixiAnime/pixiAndroid/releases/latest) · [Build it yourself](#-build-from-source) · [How it works](#-why-it-feels-fast)

</div>

---

## Install

1. Grab **pixiAndroid-vX.Y.Z.apk** from the
   [latest release](https://github.com/pixiAnime/pixiAndroid/releases/latest).
2. Open it and allow *Install unknown apps* for your file manager / browser.
3. Install, open, pick an extension URL — done.

Updates arrive the same way: a new release APK installs right over the old
one, keeping your history, list, settings and progress.

## Features

| | |
| --- | --- |
| 🧩 **Extensions** | The same extensions as the web app install from a URL and run inside an in-app QuickJS sandbox — no network access, no host access, every request passes through the app's policy layer. |
| ▶️ **A real player** | ExoPlayer under RN controls: scrub, skip 5/10/15/30 s, speed 0.5×–2×, fit/fill, audio track, sleep timer, picture-in-picture, auto-play next episode. |
| 💬 **Subtitles** | Container *and* side-loaded tracks, with size and delay control. Set the app language to **Türkçe** and Turkish picks itself; a track you tap stays picked. |
| ⏯️ **Resume** | Reopen an episode and it is **paused at the saved second** — never mid-sentence, never from zero. |
| 📱 **Gestures** | YouTube's set: tap for controls, double tap to seek, hold for 2×. A stray tap never pauses your film. |
| 🗂 **Your library** | History, My List, progress and settings live on-device (MMKV) and survive restarts, offline and all. |
| 🚀 **Cold start** | Home paints immediately; a dead metadata host is skipped in about a second instead of hanging the request. |

### Gesture cheat sheet

| Gesture | Does |
| --- | --- |
| Tap the picture | Show / hide controls (never play or pause) |
| Double tap left / right | Seek ∓ / ± by your skip distance |
| Press and hold | Play at 1.5× / 2× / 3× while held |
| 🖥 button | True fullscreen, no black frame, back exits fullscreen first |

## 📦 Why it feels fast

- **One native shell.** Header and bottom bar live outside the navigator, so a
  tab switch never remounts the chrome — it feels like Android, not a web page.
- **61 MB, R8-shrunk.** Release builds are minified down to a single 4.6 MB
  `classes.dex`, and only the ABIs people actually run are packaged
  (`arm64-v8a`, `armeabi-v7a`, `x86_64` for emulators).
- **Lists are windowed.** History and My List render the rows on screen, not
  every poster you own.
- **Requests have a deadline.** Anything that does not answer in 6 s is cut
  over to the backup source instead of stalling the page.

## 🛠 Build from source

Prerequisites: **Node ≥ 22.11**, **JDK 17+**, Android SDK with
**NDK 27.1.12297006** and **CMake 3.22.1**.

```bash
npm ci
npm run android          # debug build on a connected device / emulator
npm run build:release    # android/app/build/outputs/apk/release/app-release.apk
```

Check everything the CI checks:

```bash
npm run verify           # shared-file sync, types, lint, extension compat, tests
```

### Release signing

`assembleRelease` signs with the key in `android/keystore.properties`
(gitignored — **never commit it**), or with the committed debug key when that
file is absent, so a plain build still produces an installable APK.

For CI, publish the same values as repository secrets:

```bash
gh secret set RELEASE_KEYSTORE_B64 --body "$(base64 -w0 android/app/release.keystore)"
gh secret set RELEASE_STORE_PASSWORD   # store / key passwords from keystore.properties
gh secret set RELEASE_KEY_ALIAS --body pixi
gh secret set RELEASE_KEY_PASSWORD
```

Push a `v*` tag (or run the **Release** workflow by hand) and the APK is built
and published as a GitHub Release automatically.

> ⚠️ Back the keystore up somewhere safe. Losing it means you can never update
> an installed copy — Android will refuse the signature.

## 🧑‍💻 For developers

The full architecture notes — sandbox internals, the player's settings tree,
the fullscreen promotion, why there is no local bridge — live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

52 core files are synced **byte-for-byte** from the sibling `pixiWeb` repo and
`npm run sync:check` fails the build on drift, so the two clients share one
business logic by construction.

## ⚠️ Disclaimer

pixiAndroid hosts no media. Everything it plays comes from extensions you
install yourself; the app only fetches, decodes and shows what those sources
serve. You are responsible for what you point it at.
