/**
 * Player — the RN port of `pixiWeb/src/components/player/Player.tsx`.
 *
 * The web wraps Vidstack (`MediaPlayer` + `DefaultVideoLayout`) around a
 * bridge-resolved URL. Each Vidstack concern maps onto a concrete Android
 * mechanism, and nothing else about the component changes:
 *
 *  - **target** — `preparePlayback(source)` is the same adapter; its
 *    `{url, headers}` becomes `<Video source={{uri, headers}}>`. ExoPlayer
 *    attaches request headers to the playlist *and* every segment, so
 *    referer-protected streams play straight from the origin (no bridge).
 *  - **side-loaded text tracks** — Vidstack registers a Blob URL and parses
 *    the cues itself; here `resolveSubtitleTrack` fetches + parses the file
 *    and this component draws the active cues as an RN `Text` overlay. The
 *    timing maths lives in the pure `./subtitleCues`.
 *  - **container text tracks** (HLS `#EXT-X-MEDIA`, muxed MP4) — Vidstack
 *    surfaces those in its captions menu; ExoPlayer renders them natively via
 *    `selectedTextTrack`, so they are selected by index instead of drawn.
 *    Both kinds share one key space: a flat subtitle key, or `native:<index>`
 *    (see `./subtitleTracks`).
 *  - **layout chrome** — `DefaultVideoLayout` gives play/pause, a clock, a
 *    seek bar and a spinner; they are rebuilt here as a bottom bar that hides
 *    itself while playing — now with the skip, settings, volume and fullscreen
 *    buttons that layout ships too — plus the `SubtitleSyncControl` chip the
 *    web also overlays on the video. Controls words come from `./playerWords`
 *    because `@/i18n/layout-words` (third-party chrome, not app copy) is
 *    outside this page's write scope.
 *  - **fullscreen** — Vidstack asks the document for fullscreen; there is no
 *    equivalent on Android for a view that owns its own overlay controls, so
 *    the surface is re-parented into a `Modal` (see `toggleFullscreen`) and
 *    `@/platform/fullscreen` turns the device and clears the system bars. RN's
 *    `fullscreen` prop cannot be used: it hands the player to a native
 *    `FullScreenPlayerView` in a window of its own, where these overlay
 *    controls, the cue box and the container subtitles do not exist. The
 *    resume point is kept out of the source too: it lives in `resumeRef`,
 *    armed per episode and consumed by the first `onLoad`.
 *
 * Deviations, all deliberate:
 *
 *  - `onPlaybackError` is dropped: it existed to open the bridge-offline
 *    dialog (`PIXICLIENT_UNAVAILABLE`), which has no referent on Android.
 *    The error overlay gains a **Retry** button instead — the web's overlay
 *    was terminal, but a mobile stream failure is usually transient.
 *  - The web's fit/fill toggle (`object-fit`) has no Vidstack word, so this
 *    port draws it under three words of its own in `./playerWords`; speed and
 *    mute reuse the layout's own `Speed` / `Mute` / `Unmute`, and the output
 *    level gains a slider the layout never had (Android has no per-app volume).
 *  - A single tap on the picture toggles the chrome rather than playing or
 *    pausing: transport is the play button's job alone, so a stray tap can
 *    never pause a film (Vidstack's default single-tap does play/pause).
 *  - There is no autoplay (the web `MediaPlayer` has none either), and the
 *    player pauses while the app is backgrounded (`AppState`) without ever
 *    resuming on its own after the user paused.
 *  - The media element carries `label` as its `accessibilityLabel`; the extra
 *    `onProgressChange` push (whole-percent steps, forced on background and
 *    unmount so the final seconds survive) feeds `historyStore`'s
 *    `updateProgress`, which the store documents as the real player's job.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native'
import Video, {
  SelectedTrackType,
  type AudioTrack,
  type OnLoadData,
  type OnProgressData,
  type OnVideoErrorData,
  type OnPictureInPictureStatusChangedData,
  type VideoRef,
} from 'react-native-video'
import { useTranslation } from 'react-i18next'

import {
  ExtensionError,
  preparePlayback,
  revokePlayback,
  type FlatSource,
  type FlatSubtitle,
  type PlaybackTarget,
} from '@/extensions'
import { localizeExtensionMessage } from '@/i18n'
import { useFullscreenChrome } from '@/components/layout'
import { enterFullscreen, exitFullscreen } from '@/platform/fullscreen'
import type { Episode } from '@/providers/episode'
import type { EpisodeProgress } from '@/stores/historyStore'
import { colors, fonts, spacing } from '@/theme'

import { CueOverlay } from './player/CueOverlay'
import { BottomBar } from './player/controls/BottomBar'
import { CenterControls } from './player/controls/CenterControls'
import { TopBar } from './player/controls/TopBar'
import { PlaybackFeedback, type FeedbackFlash } from './player/feedback/PlaybackFeedback'
import { formatRate } from './player/format'
import { readPlayhead, resetPlayhead, setPlayhead } from './player/playhead'
import { resolveResumePoint } from './player/resume'
import { EpisodesSheet } from './player/sheet/EpisodesSheet'
import { SettingsSheet, type CaptionEntry } from './player/sheet/SettingsSheet'
import { ErrorState } from './player/states/ErrorState'
import { LoadingState } from './player/states/LoadingState'
import { readVolume, writeVolume } from './playerPrefs'
import { playerWord } from './playerWords'
import type { SettingsPage } from './settingsMenu'
import { cueMetrics, type SubtitleSize } from './subtitleScale'
import {
  BOOST_RATE,
  DEFAULT_SKIP_SECONDS,
  DOUBLE_TAP_WINDOW_MS,
  HOLD_THRESHOLD_MS,
  IDLE,
  stepGesture,
  zoneFor,
  type GestureState,
  type SurfaceAction,
  type SurfaceEvent,
} from './tapGestures'
import {
  nativeTrackKey,
  parseNativeTrackKey,
  resolveSubtitleTrack,
  type NativeTextTrack,
  type ResolvedSubtitleTrack,
} from './subtitleTracks'

/** Controls hide themselves after this long without a touch (web: Vidstack). */
const CONTROLS_HIDE_MS = 3500
/** How long the ending frame stays up before the next episode starts. */
const AUTO_NEXT_DELAY_MS = 1500
/**
 * Native caption line box, lifted clear of the control bar.
 *
 * The dock grew from 44 px to 96 px (44 px of gradient above the 52 px of
 * controls), so ExoPlayer's own captions move up by the same 8 px the overlay
 * cue box did — the two paths are drawn differently but must not disagree
 * about where subtitles live, or switching tracks would nudge the text.
 */
const NATIVE_SUBTITLE_PADDING_BOTTOM = 64

/**
 * Everything the player needs to move between episodes without leaving the
 * surface (§2B).
 *
 * The *list* and the *navigation* belong to `index.tsx` — it owns the query,
 * the history store and the route, and the player must not learn any of that —
 * so the page folds them into one value and the player only knows how to show
 * it. Absent means single-episode playback: every episode affordance
 * disappears outright rather than rendering as a row that goes nowhere.
 */
export interface EpisodeNav {
  episodes: Episode[]
  currentEpisode: number
  /** Episodes the history store marks as watched — highlights them in the list. */
  watched: Set<number>
  /** The list has not resolved yet; the sheet shows a spinner, not an empty box. */
  loading?: boolean
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  onSelect: (episodeNumber: number) => void
}

export interface PlayerProps {
  source: FlatSource
  /** Merged flat subtitles (providers + embedded). ASS stays metadata-only. */
  subtitles: FlatSubtitle[]
  /** Subtitle key currently shown; null = off. Either a flat key or `native:<i>`. */
  activeSubtitleKey: string | null
  /** Subtitle sync offset in seconds (±10, 0.1s steps) — shifts every cue. */
  subtitleDelay?: number
  /** Cue size for both the overlay and ExoPlayer's own subtitle rendering. */
  subtitleSize?: SubtitleSize
  /** Lifts the cue-size choice up to the page, which persists it. */
  onSubtitleSizeChange?: (size: SubtitleSize) => void
  /** Seconds the skip buttons and the double-tap gesture jump. */
  skipSeconds?: number
  onSkipSecondsChange?: (seconds: number) => void
  /** Rate a press-and-hold runs at (YouTube's "speed up"). */
  holdRate?: number
  onHoldRateChange?: (rate: number) => void
  /** Roll into the next episode when this one ends. */
  autoNext?: boolean
  /** Lifts the auto-next toggle up to the page, which owns the episode list. */
  onAutoNextChange?: (value: boolean) => void
  /** Asks the page for the next episode; absent = nowhere to go, so never fires. */
  onRequestNext?: () => void
  /**
   * In-player episode navigation (§2B) — the top bar's prev/next and the
   * episode sheet. Absent = no episode context, so neither renders.
   */
  episodeNav?: EpisodeNav
  /** `accessibilityLabel` for the media element. */
  label: string
  /** Lifts caption-menu selection (side-loaded *or* container) up to the page. */
  onSubtitleChange?: (key: string | null) => void
  /** Lifts the in-player sync-chip adjustment up to the page. */
  onSubtitleDelayChange?: (delay: number) => void
  /** Extra vs the web: watch progress (percent 0-100, position in seconds). */
  onProgressChange?: (progress: number, position: number) => void
  /**
   * Where the page's history says this episode stopped — the resume point.
   *
   * Consumed exactly once, by the first `onLoad`, and re-armed only when the
   * episode changes (this component does not remount between episodes): a
   * source switch or a retry must never drag the viewer back to a stale second.
   * Absent means "start at zero", which is every non-history playback.
   */
  resume?: EpisodeProgress | null
}

interface PrepTarget {
  uri: string
  headers?: Record<string, string>
  /** Container ExoPlayer must assume (RNV `source.type`) — see playbackAdapter. */
  contentType?: string
  /** Prep attempt — also keys the `<Video>` so a retry remounts ExoPlayer. */
  attempt: number
}

/**
 * Markers of a raw ExoPlayer failure (`errorString` such as
 * `ExoPlaybackException: ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED`, or an
 * `androidx.media3.…` exception name) — diagnostics for logcat, not copy.
 */
const NATIVE_PLAYER_ERROR = /ERROR_CODE_|androidx\.media3|\bException\b/

export function Player({
  source,
  subtitles,
  activeSubtitleKey,
  subtitleDelay = 0,
  subtitleSize = 'medium',
  onSubtitleSizeChange,
  skipSeconds = DEFAULT_SKIP_SECONDS,
  onSkipSecondsChange,
  holdRate = BOOST_RATE,
  onHoldRateChange,
  autoNext = false,
  onAutoNextChange,
  onRequestNext,
  episodeNav,
  label,
  onSubtitleChange,
  onSubtitleDelayChange,
  onProgressChange,
  resume,
}: PlayerProps) {
  const { t } = useTranslation()
  const videoRef = useRef<VideoRef>(null)
  const sourceKey = source.key
  const cueSize = cueMetrics(subtitleSize)

  /* Latest values readable inside long-lived effects (the web's `…Ref` pattern). */
  const sourceRef = useRef(source)
  const subtitleChangeRef = useRef(onSubtitleChange)
  const progressChangeRef = useRef(onProgressChange)
  const nextRef = useRef(onRequestNext)
  /** Always the page's *latest* resume value; the armed copy is `resumeRef`. */
  const resumePropRef = useRef(resume)
  sourceRef.current = source
  subtitleChangeRef.current = onSubtitleChange
  progressChangeRef.current = onProgressChange
  nextRef.current = onRequestNext
  resumePropRef.current = resume
  /** What the next first-load seeks to; null once it has been consumed. */
  const resumeRef = useRef<EpisodeProgress | null>(resume)
  /** Episode that armed value belongs to — what the effect below keys off. */
  const resumeEpisodeRef = useRef(episodeNav?.currentEpisode ?? null)

  const [prepError, setPrepError] = useState<string | null>(null)
  const [target, setTarget] = useState<PrepTarget | null>(null)
  const targetRef = useRef<PlaybackTarget | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  const [tracks, setTracks] = useState<ResolvedSubtitleTrack[]>([])
  const [nativeTracks, setNativeTracks] = useState<NativeTextTrack[]>([])

  const [buffering, setBuffering] = useState(false)
  const [ended, setEnded] = useState(false)
  const [userPaused, setUserPaused] = useState(true)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')

  const [controlsVisible, setControlsVisible] = useState(true)
  /** Bumped on every touch so the auto-hide timer restarts. */
  const [controlsEpoch, setControlsEpoch] = useState(0)
  /**
   * A scrub is in flight. The dock must not slide away under a finger that is
   * still deciding where to land, so the auto-hide timer is suspended for
   * exactly as long as this holds — reported by the scrubber from inside its
   * own responder, not derived here after the fact.
   */
  const [scrubbing, setScrubbing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Which page of the settings tree is open — see `./settingsMenu`. */
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('root')
  /**
   * The episode sheet (§2B). Its own flag, not a second value on `settingsOpen`,
   * because these are two different `Modal`s and only one may be up at a time —
   * two stacked sheets is not a stack, it is a guessing game about which one
   * the back key means. Both the guard below and the mutual exclusion in
   * `toggleSettings` / `openEpisodes` follow from this line.
   */
  const [episodesOpen, setEpisodesOpen] = useState(false)
  /** Last whole-percent handed to the history store (throttle). */
  const progressPercentRef = useRef(-1)

  /* ---------------- fullscreen / viewing preferences ---------------- */

  /**
   * Fullscreen is shell state, not local: the header and tab bar live above the
   * navigator and have to get out of the way too. Promoting the surface *in
   * place* (rather than re-parenting it into a `Modal`) is what keeps playback
   * smooth — the native view is never destroyed, so there is no reload and the
   * position is never in question. See `FullscreenChrome`.
   */
  const { fullscreen, setFullscreen } = useFullscreenChrome()
  const [rate, setRate] = useState(1)
  const [muted, setMuted] = useState(false)
  /**
   * Output level 0–1, remembered between sessions (see `playerPrefs`). It is
   * the level `muted` silences; unmuting restores whatever this holds.
   */
  const [volume, setVolume] = useState(() => readVolume())
  /** false = fit the whole frame (`contain`), true = fill the screen (`cover`). */
  const [fillMode, setFillMode] = useState(false)
  /** True while a press-and-hold is overriding the chosen rate with 2×. */
  const [boosting, setBoosting] = useState(false)
  /** Picture-in-picture is a window state Android owns; RNV reports it. */
  const [pipActive, setPipActive] = useState(false)
  /**
   * Audio tracks the stream advertises (`onAudioTracks`). Most providers send
   * exactly one, in which case there is nothing to choose and the row hides
   * itself rather than offering a list of one.
   */
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [audioIndex, setAudioIndex] = useState(0)
  /**
   * When playback should stop for the night, as an epoch ms. Kept as a
   * deadline rather than a countdown so a reload of the settings cannot
   * extend it, and cleared once it fires.
   */
  const [sleepAt, setSleepAt] = useState<number | null>(null)
  /** Ticks once a minute while a sleep timer runs, so the row can count down. */
  const [clock, setClock] = useState(() => Date.now())

  /**
   * Last playhead in seconds — read by handlers that must not re-subscribe
   * every 250ms (`position` itself would put them in a dependency array that
   * changes four times a second).
   */
  const positionRef = useRef(0)
  /** The rate the viewer picked, so a hold can be undone back to it. */
  const rateRef = useRef(1)
  /** Surface width, to split a touch into "back" and "forward". */
  const surfaceWidthRef = useRef(0)

  const paused = userPaused || !appActive || ended

  /* ---------------- history push ---------------- */

  /**
   * Push the playhead to the page (`historyStore`), at most once per whole
   * percent — unless `force`, which backgrounding and unmount use so the last
   * few seconds of a session survive instead of being rounded away.
   *
   * `measuredDuration` covers the window before `onLoad` has filled the store,
   * where the progress event itself is the only source of a duration.
   */
  const pushProgress = useCallback((force = false, measuredDuration = 0) => {
    const push = progressChangeRef.current
    if (!push) return
    const playhead = readPlayhead()
    const total = playhead.duration || measuredDuration
    if (total <= 0) return
    const percentDone = Math.min(
      100,
      Math.max(0, Math.floor((playhead.position / total) * 100)),
    )
    if (!force && percentDone === progressPercentRef.current) return
    progressPercentRef.current = percentDone
    push(percentDone, playhead.position)
  }, [])

  /* ---------------- background / foreground ---------------- */

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active')
      // Backgrounding is usually the last thing an episode sees before the OS
      // reclaims the app: write the exact second now, not the last whole
      // percent — this is the position a reopen resumes from.
      if (state !== 'active') pushProgress(true)
    })
    return () => subscription.remove()
  }, [pushProgress])

  // …and the same on the way out: leaving for the next episode must not lose
  // the final seconds of this one. Children clean up before parents, so the
  // page's callback is still alive when this runs.
  useEffect(() => () => pushProgress(true), [pushProgress])

  /* ---------------- per-source UI reset ---------------- */

  useEffect(() => {
    // A new source starts exactly like the web: idle, no autoplay, empty clock.
    setUserPaused(true)
    // Position/duration/buffered live in the playhead store now, but the reset
    // still belongs here — this is the effect that knows a *source* changed.
    resetPlayhead()
    setEnded(false)
    setBuffering(false)
    setNativeTracks([])
    setPrepError(null)
    setControlsVisible(true)
    progressPercentRef.current = -1
    positionRef.current = 0
  }, [sourceKey])

  /* ---------------- resume ---------------- */

  const currentEpisode = episodeNav?.currentEpisode ?? null

  /**
   * Arm the saved position when — and only when — the episode changes.
   *
   * The page hands over a *live* value (it keeps tracking playback), so arming
   * on the prop itself would seek back to a stale second on every history
   * write. The episode number is what makes it mean "where this episode
   * stopped" instead of "where it is now", and a source switch inside the
   * episode changes neither — so the consumed `resumeRef` stays consumed and
   * never re-seeks.
   */
  useEffect(() => {
    if (currentEpisode === resumeEpisodeRef.current) return
    resumeEpisodeRef.current = currentEpisode
    resumeRef.current = resumePropRef.current ?? null
  }, [currentEpisode])

  /* ---------------- playback target ---------------- */

  useEffect(() => {
    const current = sourceRef.current
    if (!current) return
    let cancelled = false
    setPrepError(null)
    setTarget(null) // blank the previous source while the new one resolves

    preparePlayback(current)
      .then((next) => {
        if (cancelled) {
          revokePlayback(next)
          return
        }
        revokePlayback(targetRef.current)
        targetRef.current = next
        setTarget({
          uri: next.url,
          headers: next.headers,
          contentType: next.contentType,
          attempt: retryToken,
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setPrepError(
          err instanceof ExtensionError ? err.message : 'Playback could not be started.',
        )
      })

    return () => {
      cancelled = true
      revokePlayback(targetRef.current)
      targetRef.current = null
    }
    // Keyed by source identity + retry token, not by the target object itself.
  }, [sourceKey, retryToken])

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
  }, [])

  /* ---------------- side-loaded subtitle tracks ---------------- */

  // `subtitles` is identity-stable (see `useExtensionSources`), so this runs
  // once per track-set change instead of once per render.
  useEffect(() => {
    let cancelled = false
    Promise.all(subtitles.map((sub) => resolveSubtitleTrack(sub))).then((resolved) => {
      const next = resolved.filter((track): track is ResolvedSubtitleTrack => track !== null)
      if (cancelled) return
      setTracks(next)
    })
    return () => {
      cancelled = true
    }
  }, [subtitles])

  /* ---------------- container track bookkeeping ---------------- */

  // A container track dies with its source; forget a selection that no longer
  // exists so the page does not keep a key ExoPlayer cannot honour.
  useEffect(() => {
    const index = parseNativeTrackKey(activeSubtitleKey)
    if (index === null) return
    if (nativeTracks.some((track) => track.index === index)) return
    subtitleChangeRef.current?.(null)
  }, [activeSubtitleKey, nativeTracks])

  /* ---------------- controls auto-hide ---------------- */

  useEffect(() => {
    // A sheet is a layer *over* the player, and dismissing it must not reveal
    // a bare video with no controls: while one is up the dock holds still
    // rather than timing itself out from underneath it. The timer restarts the
    // moment the sheet goes, so the ordinary 3.5 s still applies.
    if (paused || scrubbing || settingsOpen || episodesOpen) {
      setControlsVisible(true)
      return
    }
    const timer = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS)
    return () => clearTimeout(timer)
  }, [paused, scrubbing, settingsOpen, episodesOpen, controlsVisible, controlsEpoch])

  /**
   * The dock's fade and its small rise. It is one `Animated.Value` so the
   * scrim and the controls leave on the *same* timeline — a scrim that lingers
   * a frame after its buttons is exactly the kind of seam §16 is about — and
   * driven natively, because the alternative (an `opacity` style re-render)
   * would put a React render on the auto-hide path for no reason.
   *
   * All three chrome groups read this one value: the dock, the top bar and the
   * centre controls. `interpolate` is free — it is a mapping evaluated by the
   * native driver, not a second animation — so giving the top bar its own
   * `-8 → 0` costs nothing and stops the two ends of the frame disagreeing.
   */
  const dockOpacity = useRef(new Animated.Value(1)).current
  const dockTranslate = useMemo(
    () => dockOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
    [dockOpacity],
  )
  /** The top bar slides *outward* while everything below slides inward. */
  const topTranslate = useMemo(
    () => dockOpacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
    [dockOpacity],
  )

  useEffect(() => {
    Animated.timing(dockOpacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: controlsVisible ? 180 : 260,
      useNativeDriver: true,
      isInteraction: false,
    }).start()
  }, [controlsVisible, dockOpacity])

  /* ---------------- derived subtitle state ---------------- */

  const activeTrack = useMemo(
    () => tracks.find((track) => track.key === activeSubtitleKey) ?? null,
    [tracks, activeSubtitleKey],
  )

  /**
   * Which side-loaded cues are active is not computed here any more: drawing
   * them needs the playhead, and a `useMemo` over `position` was the single
   * largest reason a 250 ms tick re-rendered the whole player. `CueOverlay`
   * subscribes itself and only re-renders when the visible text changes.
   */
  const nativeIndex = parseNativeTrackKey(activeSubtitleKey)
  const selectedTextTrack =
    nativeIndex !== null
      ? { type: SelectedTrackType.INDEX, value: nativeIndex }
      : { type: SelectedTrackType.DISABLED }

  const captionEntries = useMemo<CaptionEntry[]>(() => {
    const sideLoaded: CaptionEntry[] = subtitles
      .filter((sub) => sub.format !== 'ass')
      .map((sub) => ({
        key: sub.key,
        label: sub.label ?? sub.language,
        language: sub.language,
        format: sub.format,
      }))
    const container: CaptionEntry[] = nativeTracks.map((track) => ({
      key: nativeTrackKey(track.index),
      label: track.title ?? track.language ?? track.type ?? `${track.index}`,
      language: track.language ?? '',
    }))
    return [...sideLoaded, ...container]
  }, [subtitles, nativeTracks])


  /** Minutes still to run on a sleep timer, or `null` while it is off. */
  const sleepMinutes =
    sleepAt === null ? null : Math.max(1, Math.ceil((sleepAt - clock) / 60_000))

  /* ---------------- handlers ---------------- */

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    setControlsEpoch((epoch) => epoch + 1)
  }, [])

  /**
   * Move the playhead.
   *
   * `duration` is read from the store rather than closed over, which makes
   * this callback stable for the life of the component — every skip, every
   * gesture and every scrub now depends on the same function identity instead
   * of rebuilding a chain of callbacks whenever `onLoad` fired.
   */
  const seekTo = useCallback((time: number) => {
    const total = readPlayhead().duration
    const clamped = total > 0 ? Math.max(0, Math.min(total, time)) : Math.max(0, time)
    videoRef.current?.seek(clamped)
    setPlayhead({ position: clamped })
    positionRef.current = clamped
    setEnded(false)
  }, [])

  const togglePlayback = useCallback(() => {
    if (ended) {
      videoRef.current?.seek(0)
      setPlayhead({ position: 0 })
      positionRef.current = 0
      setEnded(false)
      setUserPaused(false)
      return
    }
    setUserPaused((wasPaused) => !wasPaused)
  }, [ended])

  /** The skip buttons — and, since the redesign, TalkBack's actions too. */
  const skipBy = useCallback(
    (delta: number) => {
      revealControls()
      seekTo(positionRef.current + delta)
    },
    [revealControls, seekTo],
  )

  /**
   * Enter/exit fullscreen.
   *
   * The surface stays exactly where it is in the tree and simply changes shape:
   * the page collapses around it, the shell drops its header and tab bar, and
   * `PixiFullscreen` turns the device landscape with the system bars hidden
   * (restoring both on the way out). Nothing about the player is remounted, so
   * there is no reload and no lost position.
   */
  /**
   * Hand the video to Android's picture-in-picture window.
   *
   * The entry is a *button* rather than a setting because it is an action, and
   * an action on the bar is where a thumb expects it. Android reports the
   * window state back (`onPictureInPictureStatusChanged`), so the icon
   * follows the system dismissing PiP too, not just our own taps.
   */
  const togglePip = useCallback(() => {
    revealControls()
    if (pipActive) videoRef.current?.exitPictureInPicture()
    else videoRef.current?.enterPictureInPicture()
  }, [pipActive, revealControls])

  /** Close the sheet from anywhere: picture, gear, or the back key. */
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsPage('root')
  }, [])

  /**
   * The gear, and the only way the settings sheet opens. It takes the episode
   * sheet down on its way up — one sheet at a time, per `episodesOpen`.
   */
  const toggleSettings = useCallback(() => {
    revealControls()
    setEpisodesOpen(false)
    if (settingsOpen) closeSettings()
    else setSettingsOpen(true)
  }, [closeSettings, revealControls, settingsOpen])

  /** The top bar's list icon. The mirror of `toggleSettings`, same reason. */
  const openEpisodes = useCallback(() => {
    revealControls()
    closeSettings()
    setEpisodesOpen(true)
  }, [closeSettings, revealControls])

  const closeEpisodes = useCallback(() => setEpisodesOpen(false), [])

  /**
   * Picking an episode: the sheet leaves *first*, so it is seen to close, and
   * only then does the page navigate — which swaps the source under a sheet
   * that is still mid-slide reads as a glitch rather than as a transition.
   */
  const handleEpisodeSelect = useCallback(
    (episodeNumber: number) => {
      closeEpisodes()
      episodeNav?.onSelect(episodeNumber)
    },
    [closeEpisodes, episodeNav],
  )

  /**
   * The sheet reports *what* changed; these are the only places that know what
   * changing it means. `handleRateChange` writes `rateRef` as well as the state
   * because a press-and-hold reads that ref back when it lets go — the menu
   * re-arming the hold speed is not optional bookkeeping, it is the same value
   * the gesture will restore.
   */
  const handleRateChange = useCallback((next: number) => {
    rateRef.current = next
    setRate(next)
  }, [])
  /**
   * The volume slider. Persisted on every tick — MMKV writes are cheap and the
   * alternative is losing the level if the app is killed mid-drag — and any
   * level above zero counts as "not muted", so nudging the rail up is the same
   * gesture as unmuting.
   */
  const handleVolumeChange = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(1, next))
    setVolume(clamped)
    writeVolume(clamped)
    if (clamped > 0) setMuted(false)
  }, [])
  const handleSleepChange = useCallback((minutes: number) => {
    setClock(Date.now())
    setSleepAt(minutes === 0 ? null : Date.now() + minutes * 60_000)
  }, [])
  const handleAudioTrackChange = useCallback((index: number) => setAudioIndex(index), [])
  /** Via the ref so a sheet that outlives a prop change still hits the page. */
  const handleSubtitleTrackChange = useCallback(
    (key: string | null) => subtitleChangeRef.current?.(key),
    [],
  )

  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen
    closeSettings()
    setEpisodesOpen(false)
    setFullscreen(next)
    revealControls()
    if (next) enterFullscreen()
    else exitFullscreen()
  }, [closeSettings, fullscreen, revealControls, setFullscreen])

  /* ---------------- surface gestures ---------------- */

  /**
   * YouTube's gesture set — a single tap toggles the chrome, a double tap on
   * either half seeks ±10 s, a press and hold runs at 2× for as long as it is
   * held. The single tap deliberately does *not* play/pause: that is the play
   * button's job, so a stray tap on the picture can never pause a film. The
   * arbitration itself is the pure `tapGestures` machine; this is only the
   * timer plumbing that turns it into taps.
   */
  const gestureRef = useRef<GestureState>(IDLE)
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * The last skip, for `PlaybackFeedback`.
   *
   * Deliberately a fresh `{ direction, token }` object per skip rather than a
   * bare `SurfaceZone`: two skips in the same direction must re-run the flash
   * animation, and passing the same value twice would let React bail out and
   * leave the overlay already faded. The animation itself lives in the
   * feedback component now; this is only its trigger.
   */
  const flashTokenRef = useRef(0)
  const [skipFlash, setSkipFlash] = useState<FeedbackFlash | null>(null)

  const runGestureAction = useCallback(
    (action: SurfaceAction) => {
      if (action.type === 'chrome') {
        // A lone tap flips the chrome — never the transport. A paused player
        // keeps its controls up (the auto-hide effect pins them), so the only
        // meaningful tap there is a reveal.
        if (paused) revealControls()
        else setControlsVisible((visible) => !visible)
        return
      }
      revealControls()
      if (action.type === 'boost') {
        setBoosting(true)
        setRate(holdRate)
        return
      }
      if (action.type === 'unboost') {
        setBoosting(false)
        setRate(rateRef.current)
        return
      }
      // A skip: move, then flash which way it went, as YouTube does.
      skipBy(action.zone === 'back' ? -skipSeconds : skipSeconds)
      flashTokenRef.current += 1
      setSkipFlash({ direction: action.zone, token: flashTokenRef.current })
    },
    [holdRate, paused, revealControls, skipBy, skipSeconds],
  )

  const sendGesture = useCallback(
    (event: SurfaceEvent) => {
      const step = stepGesture(gestureRef.current, event)
      gestureRef.current = step.state

      if (step.timers.expire) {
        if (expireTimerRef.current) clearTimeout(expireTimerRef.current)
        expireTimerRef.current = setTimeout(
          () => sendGesture({ type: 'expire' }),
          DOUBLE_TAP_WINDOW_MS,
        )
      } else if (expireTimerRef.current) {
        clearTimeout(expireTimerRef.current)
        expireTimerRef.current = null
      }

      if (step.timers.hold) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
        holdTimerRef.current = setTimeout(() => sendGesture({ type: 'hold' }), HOLD_THRESHOLD_MS)
      } else if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }

      if (step.action) runGestureAction(step.action)
    },
    [runGestureAction],
  )

  // A gesture in flight when the component goes away must not fire into it.
  useEffect(
    () => () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    },
    [],
  )

  const handleSurfaceDown = useCallback(
    (event: GestureResponderEvent) => {
      sendGesture({ type: 'down', zone: zoneFor(event.nativeEvent.locationX, surfaceWidthRef.current) })
    },
    [sendGesture],
  )

  const handleSurfaceUp = useCallback(() => sendGesture({ type: 'up' }), [sendGesture])

  /* ---------------- fullscreen side effects ---------------- */

  // Leaving the screen while fullscreen (a back gesture, a tab) must hand the
  // device back: the rotation lock and the hidden system bars would outlive us,
  // and the shell would keep its chrome hidden.
  useEffect(
    () => () => {
      setFullscreen(false)
      exitFullscreen()
    },
    [setFullscreen],
  )

  // Android's back button leaves fullscreen before it leaves the page.
  useEffect(() => {
    if (!fullscreen) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      toggleFullscreen()
      return true
    })
    return () => subscription.remove()
  }, [fullscreen, toggleFullscreen])

  // …and while a sheet is up it must close that before it touches fullscreen.
  // The sheet owns the key now — a `Modal` takes it — and its `onRequestClose`
  // walks up the settings tree first, so a menu open in fullscreen still closes
  // one page at a time rather than exiting to the page underneath.
  //
  // Re-asserting is the reason this is an effect and not just a call at open
  // time: `useFullscreenChrome` hands the orientation and the system bars back
  // whenever it re-runs, so anything that can cause a re-render while a sheet
  // is up could otherwise leave the picture windowed *behind* the sheet.
  useEffect(() => {
    if (!fullscreen || !(settingsOpen || episodesOpen)) return
    enterFullscreen()
  }, [fullscreen, settingsOpen, episodesOpen])

  // Sleep timer: stop playback at the deadline. Two timers, one for the
  // deadline itself and one only while it is running, so the row in the menu
  // can show what is left without re-rendering the player every second.
  useEffect(() => {
    if (sleepAt === null) return
    const remaining = sleepAt - Date.now()
    if (remaining <= 0) {
      setSleepAt(null)
      setUserPaused(true)
      return
    }
    const stop = setTimeout(() => {
      setSleepAt(null)
      setUserPaused(true)
    }, remaining)
    const tick = setInterval(() => setClock(Date.now()), 30_000)
    return () => {
      clearTimeout(stop)
      clearInterval(tick)
    }
  }, [sleepAt])

  // Auto-next: a beat after the credits, roll into the next episode — but only
  // if the page actually has one to go to.
  useEffect(() => {
    if (!ended || !autoNext) return
    const next = nextRef.current
    if (!next) return
    const timer = setTimeout(next, AUTO_NEXT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [autoNext, ended])

  /**
   * TalkBack's increment/decrement on the *picture*.
   *
   * It steps by `skipSeconds`, the same number the on-screen skip buttons use
   * — and the same number the action labels announce. There used to be a
   * second, hard-coded 10 s step here, so a viewer who had set "skip 15s" got
   * a button that said 15 and moved 10.
   */
  const handleSurfaceAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const name = event.nativeEvent.actionName
      // `activate` is the screen reader's "double tap" on the picture. Since a
      // touch tap only flips the chrome now, transport has to stay reachable:
      // activating the picture plays/pauses, as it always did for TalkBack.
      if (name === 'activate') {
        togglePlayback()
        return
      }
      const direction = name === 'increment' ? 1 : -1
      skipBy(direction * skipSeconds)
    },
    [skipBy, skipSeconds, togglePlayback],
  )

  /**
   * The picture doubles as the transport and seek control for a screen reader:
   * it cannot double-tap the picture for a skip, and a touch tap no longer
   * reaches the play button, so `activate` plays/pauses while
   * increment/decrement skips.
   */
  const surfaceAccessibilityActions = useMemo(
    () => [
      { name: 'activate', label: paused ? playerWord('play') : playerWord('pause') },
      { name: 'increment', label: `+${skipSeconds}s` },
      { name: 'decrement', label: `−${skipSeconds}s` },
    ],
    [paused, skipSeconds],
  )

  /**
   * Metadata is ready: record the duration and — once, for the first load of
   * an episode — open where the viewer left off.
   *
   * Consuming `resumeRef` *before* the seek is what makes it one-shot: a
   * retry, a manual source switch or a second `onLoad` for the same media
   * finds `null` and starts from zero. The thresholds live in
   * `./player/resume` (too early to be worth resuming, or already watched).
   */
  const handleLoad = useCallback((data: OnLoadData) => {
    const duration = data.duration || 0
    setPlayhead({ duration })

    const saved = resumeRef.current
    resumeRef.current = null
    const at = saved ? resolveResumePoint(saved, duration) : 0
    if (at > 0) {
      // Paused, so the frame the viewer comes back to *is* the resume point;
      // play continues from there (no autoplay, as everywhere else).
      videoRef.current?.seek(at)
      positionRef.current = at
      setPlayhead({ position: at })
    }

    setNativeTracks(
      data.textTracks.map((track) => ({
        index: track.index,
        title: track.title,
        language: track.language,
        type: track.type ?? undefined,
      })),
    )
  }, [])

  /**
   * Every 250ms (`progressUpdateInterval`).
   *
   * This is the hot path the redesign was mostly about. It used to call
   * `setPosition`, which re-rendered the entire player — settings tree,
   * gesture layer, cue box, everything — four times a second. Now it writes
   * one store, and the only React work that store causes is a number changing
   * inside `ProgressBar` and `CueOverlay`, both of which are leaves.
   *
   * The history push is `updateProgress`'s job and the page never sees this
   * event — it happens through `pushProgress`, which drops everything short of
   * a whole percent (backgrounding and unmount force a final, exact one).
   */
  function handleProgress(data: OnProgressData) {
    const at = data.currentTime || 0
    positionRef.current = at
    setPlayhead({ position: at, buffered: data.playableDuration || 0 })
    pushProgress(false, data.seekableDuration || 0)
  }

  const handleError = useCallback(
    (event: OnVideoErrorData) => {
      // The viewer gets the localized copy below; the underlying player code
      // (e.g. `ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED`) is what a report
      // needs, so it goes to the log in one compact line.
      console.warn('[player]', event.error?.errorString || event.error?.errorException || 'error')
      const raw =
        event.error?.localizedDescription || event.error?.error || event.error?.errorString || ''
      // ExoPlayer reports failures as Java exceptions (`ExoPlaybackException:
      // ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED`, plus a stack trace). That
      // belongs in logcat, never in front of a viewer — anything reading as
      // native machinery is swapped for the localized copy, while the raw text
      // stays in the console above so the cause is still diagnosable.
      const detail = NATIVE_PLAYER_ERROR.test(raw)
        ? t('extMsg.playbackFailed')
        : raw || t('extMsg.playbackNotStarted')
      setPrepError((previous) => previous ?? detail)
    },
    [t],
  )

  /* ---------------- render ---------------- */

  const surface = (
    <View
      onLayout={(event) => {
        // Gesture zones split the surface down the middle (see `zoneFor`).
        surfaceWidthRef.current = event.nativeEvent.layout.width
      }}
      style={fullscreen ? styles.surfaceFull : styles.surface}>
      {target ? (
        <Video
          key={`${target.uri}|${target.attempt}`}
          ref={videoRef}
          accessibilityLabel={label}
          source={{
            uri: target.uri,
            headers: target.headers,
            type: target.contentType,
            // Streaming CDNs fail transiently — a 502 or 503 on one segment
            // is a hiccup, not a broken stream, and ExoPlayer's default is to
            // give up on the first one and show the error overlay. Three
            // retries with its default backoff recover the common case without
            // the viewer touching anything; a genuinely dead source still ends
            // in the overlay, just later.
            minLoadRetryCount: 3,
          }}
          style={styles.video}
          paused={paused}
          rate={rate}
          muted={muted}
          volume={volume}
          resizeMode={fillMode ? 'cover' : 'contain'}
          progressUpdateInterval={250}
          enterPictureInPictureOnLeave={false}
          onAudioTracks={(event) => setAudioTracks(event.audioTracks)}
          onPictureInPictureStatusChanged={(event: OnPictureInPictureStatusChangedData) =>
            setPipActive(event.isActive)
          }
          selectedAudioTrack={{ type: SelectedTrackType.INDEX, value: audioIndex }}
          selectedTextTrack={selectedTextTrack}
          subtitleStyle={{
            fontSize: cueSize.nativeFontSize,
            paddingBottom: NATIVE_SUBTITLE_PADDING_BOTTOM,
          }}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onBuffer={(event) => setBuffering(event.isBuffering)}
          onError={handleError}
          onEnd={() => setEnded(true)}
        />
      ) : null}

      {/*
        Gesture target: a single tap toggles the chrome (never play/pause), a
        double tap on either half seeks ±10 s, and a press and hold runs at 2×
        (the arbitration is `./tapGestures`). Because a touch tap no longer
        reaches transport, the screen reader gets `activate` for play/pause.
      */}
      <Pressable
        accessibilityActions={surfaceAccessibilityActions}
        accessibilityLabel={
          controlsVisible ? playerWord('hideControls') : playerWord('showControls')
        }
        accessibilityRole="button"
        onAccessibilityAction={handleSurfaceAction}
        onPressIn={handleSurfaceDown}
        onPressOut={handleSurfaceUp}
        style={styles.surfaceTap}
      />

      {/*
        Two different waits, dressed differently: no resolved target dims the
        picture and labels itself, while a buffer hiccup stays invisible until
        it has lasted long enough to be worth a spinner. Neither is allowed to
        eat a touch — the gesture layer underneath stays live throughout.
      */}
      <LoadingState
        buffering={buffering && prepError === null}
        preparing={!target && prepError === null}
      />

      {/* Side-loaded cues — our overlay, never ExoPlayer's. */}
      <CueOverlay
        delay={subtitleDelay}
        fontSize={cueSize.fontSize}
        lineHeight={cueSize.lineHeight}
        track={activeTrack}
      />

      {/*
        The top of the frame: the episode navigation, plus the title — but only
        in fullscreen, where the page's own header is gone. It rides the *same*
        `dockOpacity` as the dock, sliding outward while everything below slides
        inward, so "are the controls up" has exactly one timeline rather than
        two that could drift apart by a frame.
      */}
      <Animated.View
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
        style={[styles.topBar, { opacity: dockOpacity, transform: [{ translateY: topTranslate }] }]}>
        <TopBar
          episodesActive={episodesOpen}
          label={label}
          onNextEpisode={episodeNav?.hasNext ? episodeNav.onNext : undefined}
          onEpisodes={episodeNav ? openEpisodes : undefined}
          onExitFullscreen={fullscreen ? toggleFullscreen : undefined}
          onPrevEpisode={episodeNav?.hasPrev ? episodeNav.onPrev : undefined}
          showLabel={fullscreen}
        />
      </Animated.View>

      {/*
        The one large control, centred where a thumb goes without aiming.
        `absoluteFill` + `box-none` is what keeps this from becoming a dead
        zone: it takes touches on its own three buttons and nothing else, so
        tapping the picture *beside* the play button still toggles the chrome
        and a double tap there still skips — the middle of the frame is still
        the middle of the frame.
      */}
      <Animated.View
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
        style={[StyleSheet.absoluteFill, { opacity: dockOpacity }]}>
        <CenterControls
          ended={ended}
          onSkip={skipBy}
          onToggle={() => {
            revealControls()
            togglePlayback()
          }}
          paused={paused}
          skipSeconds={skipSeconds}
        />
      </Animated.View>

      {/*
        Gesture feedback: which way the skip went, and the hold-speed badge.
        Rendered *after* `CenterControls` on purpose — the skip chip is anchored
        to the left/right edge, but stacking it above the centred play button is
        what guarantees it is never hidden behind it. It owns its own timelines;
        a fresh object per skip re-animates a repeat.
      */}
      <PlaybackFeedback
        boost={boosting ? formatRate(holdRate) : null}
        flash={skipFlash}
        flashLabel={
          skipFlash
            ? `${playerWord(skipFlash.direction === 'back' ? 'seekBackward' : 'seekForward')} ${skipSeconds}s`
            : ''
        }
      />

      {/*
        The bottom dock: one gradient and the controls standing on it, fading
        and rising as a single unit so neither can outlive the other by a
        frame.

        `box-none`, not `auto`. An opaque panel used to swallow every tap in
        its dead zones; a gradient is the *picture* showing through, so a tap
        anywhere in it falls through to the gesture layer below and still
        toggles the controls — which is what anyone means by "the dark bit at
        the bottom".
      */}
      <Animated.View
        pointerEvents={controlsVisible ? 'box-none' : 'none'}
        style={[styles.dock, { opacity: dockOpacity, transform: [{ translateY: dockTranslate }] }]}>
        <BottomBar
          fullscreen={fullscreen}
          muted={muted}
          onInteract={revealControls}
          onScrubChange={setScrubbing}
          onSeek={seekTo}
          onSeekStep={(direction) => skipBy(direction * skipSeconds)}
          onSettings={toggleSettings}
          onToggleFullscreen={toggleFullscreen}
          onToggleMuted={() => {
            revealControls()
            setMuted((wasMuted) => !wasMuted)
          }}
          onTogglePip={togglePip}
          pipActive={pipActive}
          rate={rate}
          settingsOpen={settingsOpen}
          stepSeconds={skipSeconds}
        />
      </Animated.View>

      {/*
        Settings, subtitles, speed and the rest are now a sheet *over* the
        picture rather than a panel in it: full-width, under the thumb, and a
        `Modal` — which is the whole point, because a Modal can never become an
        ancestor of `<Video>`. The tree, its words and its callbacks are all
        unchanged; only the room moved (see `player/sheet/SettingsSheet`).
      */}
      <SettingsSheet
        activeSubtitleKey={activeSubtitleKey}
        audioIndex={audioIndex}
        audioTracks={audioTracks}
        autoNext={autoNext}
        autoNextAvailable={onRequestNext !== undefined}
        captionEntries={captionEntries}
        fillMode={fillMode}
        holdRate={holdRate}
        onAudioTrackChange={handleAudioTrackChange}
        onAutoNextChange={onAutoNextChange}
        onHoldRateChange={onHoldRateChange}
        onClose={closeSettings}
        onFillModeChange={setFillMode}
        onInteract={revealControls}
        onPage={setSettingsPage}
        onRateChange={handleRateChange}
        onSleepChange={handleSleepChange}
        onSkipSecondsChange={onSkipSecondsChange}
        onSubtitleDelayChange={onSubtitleDelayChange}
        onSubtitleSizeChange={onSubtitleSizeChange}
        onSubtitleTrackChange={handleSubtitleTrackChange}
        onVolumeChange={handleVolumeChange}
        page={settingsPage}
        rate={rate}
        skipSeconds={skipSeconds}
        sleepMinutes={sleepMinutes}
        subtitleDelay={subtitleDelay}
        subtitleSize={subtitleSize}
        visible={settingsOpen}
        volume={volume}
      />

      {/*
        The episode list, as a sheet, for exactly the reasons the settings
        tree is one: full width, under the thumb, and a `Modal` — so it can
        never become an ancestor of `<Video>`, and it owns the Android back
        key. It renders the page's own `EpisodeList`, so the scroll-into-view
        behaviour is written once and behaves the same in both places.
      */}
      {episodeNav ? (
        <EpisodesSheet
          currentEpisode={episodeNav.currentEpisode}
          episodes={episodeNav.episodes}
          isLoading={episodeNav.loading}
          onClose={closeEpisodes}
          onSelect={handleEpisodeSelect}
          title={playerWord('episodes')}
          visible={episodesOpen}
          watched={episodeNav.watched}
        />
      ) : null}

      {/* Prep / playback failure — §13: the surface stays exactly where it
          is, the reason arrives localised, and one tap tries again. */}
      {prepError ? (
        <ErrorState message={localizeExtensionMessage(prepError, t)} onRetry={retry} />
      ) : null}
    </View>
  )

  // Same tree in both modes — that is the whole point. The only thing
  // fullscreen adds is the status bar going away, and RN puts it back when this
  // unmounts.
  return (
    <>
      {fullscreen ? <StatusBar hidden /> : null}
      {surface}
    </>
  )
}

/** Compact resolving indicator shown while sources are being collected. */
export function ResolvingSource() {
  const { t } = useTranslation()
  return (
    <View style={styles.resolving}>
      <ActivityIndicator color={colors.mutedForeground} size="small" />
      <Text style={styles.resolvingText}>{t('watch.resolving')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /** `relative aspect-video w-full overflow-hidden border bg-card` */
  surface: {
    aspectRatio: 16 / 9,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /**
   * Fullscreen: the surface fills the column instead of being a 16:9 box — the
   * page hides its body and the shell hides its chrome, so this is all that is
   * left, edge to edge, with no border and no aspect ratio to letterbox in.
   */
  surfaceFull: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
  },

  /** Full-surface tap target, under every piece of chrome. */
  surfaceTap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  /**
   * The bottom dock — a gradient that has room to *be* a gradient, rather than
   * the 52 px panel it stands on.
   *
   * The 44 px of padding above the controls is not decoration. A gradient has
   * to travel before it can be worth ~0.85 black behind the icons, and if the
   * whole thing were only as tall as the bar it would have to be near-opaque by
   * its midpoint — which is a panel wearing a gradient's clothes. Because the
   * dock is `box-none`, that padding is touch-transparent: taps fall through to
   * the gesture layer, which is what anyone means by "the dark bit at the
   * bottom".
   */
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 44,
  },
  /**
   * The top of the frame. It has no background of its own — `Scrim edge="top"`,
   * rendered inside `TopBar`, *is* the background, exactly as the dock's scrim
   * is theirs. The height comes entirely from `TopBar`'s own row and the
   * gradient run beneath it, so this is only the box that positions it.
   */
  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },

  retryLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.foreground },

  resolving: {
    aspectRatio: 16 / 9,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  resolvingText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
})
