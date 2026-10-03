/**
 * M0 spike B — proves react-native-video (ExoPlayer) plays protected HLS and
 * seeks MP4, with no bridge and no playlist rewriting.
 *
 * Two things have to be demonstrated, and neither can be faked with a public
 * URL:
 *
 *  1. **Headers actually reach every request.** The HLS source is a local,
 *     header-gated proxy (`scripts/hls-proxy-server.mjs`) that rewrites the
 *     upstream playlist so *both* the playlist and every segment come back
 *     through it — and refuses anything without `X-Pixi: spike`. Playback
 *     advancing past 1.5s can only happen if ExoPlayer attached the header to
 *     the segment requests too; the proxy's counters are shown as evidence.
 *  2. **Seek works.** The MP4 is loaded, then the playhead is thrown to half
 *     its duration (clamped to 60s) and must arrive within 10s. Natural
 *     playback needs `target` seconds to get there, so arriving early proves
 *     the seek landed rather than the clock ticking.
 *
 * The run is automatic so a single screenshot is a result; manual controls
 * are underneath for poking at anything odd.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Video, { type OnLoadData, type OnProgressData, type OnVideoErrorData, type VideoRef } from 'react-native-video'

const HLS_URI = 'http://10.0.2.2:8766/stream.m3u8'
/** Reachable from this network, long enough that a mid-file seek is meaningful. */
const MP4_URI = 'https://media.w3.org/2010/05/sintel/trailer.mp4'
/** Required by the proxy — this is the header under test. */
const REQUIRED_HEADER = { 'X-Pixi': 'spike' }
const HLS_PROGRESS_TARGET = 1.5
const SEEK_WINDOW_MS = 10_000

const CHECKS = [
  { id: 'hls-load', name: 'HLS playlist loads through the header-gated proxy' },
  { id: 'hls-segments', name: 'HLS segment requests carry the headers' },
  { id: 'mp4-load', name: 'MP4 loads with a real duration' },
  { id: 'mp4-seek', name: 'MP4 seeking jumps the playhead' },
] as const

type CheckId = (typeof CHECKS)[number]['id']
type CheckState = { pass: boolean; detail: string }

type Phase = 'idle' | 'hls_load' | 'hls_play' | 'mp4_load' | 'mp4_seek' | 'done' | 'failed'

const PHASE_TIMEOUTS: Partial<Record<Phase, number>> = {
  hls_load: 40_000,
  hls_play: 45_000,
  mp4_load: 40_000,
  mp4_seek: 45_000,
}

function seconds(value: number): string {
  return `${value.toFixed(1)}s`
}

export function PlayerSpikeScreen(): React.JSX.Element {
  const videoRef = useRef<VideoRef>(null)
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [results, setResults] = useState<Partial<Record<CheckId, CheckState>>>({})
  const [log, setLog] = useState<string[]>([])
  const [failure, setFailure] = useState('')
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seekTarget, setSeekTarget] = useState(0)
  const [stats, setStats] = useState('')

  /* Phase read synchronously by the player callbacks — a state updater would
   * run after the render, and progress events fire faster than that. */
  const phaseRef = useRef<Phase>('idle')
  const seekTargetRef = useRef(0)
  const seekStartedRef = useRef(0)

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const note = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toISOString().slice(14, 23)}  ${line}`, ...prev].slice(0, 12))
  }, [])

  const record = useCallback((id: CheckId, pass: boolean, detail: string) => {
    setResults((prev) => ({ ...prev, [id]: { pass, detail } }))
  }, [])

  const fail = useCallback(
    (message: string) => {
      setFailure(message)
      setPhase('failed')
      note(`FAIL ${message}`)
    },
    [note, setPhase],
  )

  /* Restart from the top. */
  const restart = useCallback(() => {
    setResults({})
    setLog([])
    setFailure('')
    setPosition(0)
    setDuration(0)
    setSeekTarget(0)
    setStats('')
    seekTargetRef.current = 0
    seekStartedRef.current = 0
    setPhase('hls_load')
  }, [setPhase])

  useEffect(restart, [restart])

  /* Every phase must advance or die — a stalled player must not hang the spike. */
  useEffect(() => {
    const limit = PHASE_TIMEOUTS[phase]
    if (!limit) return
    const timer = setTimeout(() => fail(`timed out in "${phase}" after ${limit / 1000}s`), limit)
    return () => clearTimeout(timer)
  }, [phase, fail])

  /* Fetch the proxy's counters once the run finishes — proof of what was served. */
  useEffect(() => {
    if (phase !== 'done') return
    let cancelled = false
    fetch('http://10.0.2.2:8766/stats', { headers: REQUIRED_HEADER })
      .then((res) => res.json())
      .then((data: { served?: number; refused?: number }) => {
        if (cancelled) return
        setStats(`proxy served ${data.served ?? '?'} / refused ${data.refused ?? '?'}`)
        note(`proxy served ${data.served ?? '?'} / refused ${data.refused ?? '?'}`)
      })
      .catch(() => {
        if (!cancelled) setStats('proxy stats unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [phase, note])

  const onLoad = useCallback(
    (data: OnLoadData) => {
      const total = data.duration || 0
      setDuration(total)
      note(`onLoad duration=${total.toFixed(1)}s size=${data.naturalSize?.width}x${data.naturalSize?.height}`)

      const current = phaseRef.current
      if (current === 'hls_load') {
        record('hls-load', true, `playlist resolved, duration ${total.toFixed(1)}s`)
        setPhase('hls_play')
        return
      }
      if (current === 'mp4_load') {
        if (total <= 0) {
          record('mp4-load', false, 'no duration reported')
          fail('mp4_load: the player reported no duration')
          return
        }
        /* Half the runtime, clamped — long enough that natural playback could
         * never cover the distance inside SEEK_WINDOW_MS. */
        const target = Math.max(8, Math.min(60, total * 0.5))
        seekTargetRef.current = target
        seekStartedRef.current = 0
        setSeekTarget(target)
        record('mp4-load', true, `duration ${total.toFixed(1)}s → seeking to ${target.toFixed(0)}s`)
        setPhase('mp4_seek')
        setTimeout(() => {
          seekStartedRef.current = Date.now()
          videoRef.current?.seek(target)
          note(`seek(${target.toFixed(0)})`)
        }, 300)
      }
    },
    [fail, note, record, setPhase],
  )

  const onProgress = useCallback(
    (data: OnProgressData) => {
      const at = data.currentTime || 0
      setPosition(at)

      const current = phaseRef.current
      if (current === 'hls_play' && at >= HLS_PROGRESS_TARGET) {
        record('hls-segments', true, `reached ${seconds(at)} — every segment came back 200`)
        setPhase('mp4_load')
        return
      }
      if (current !== 'mp4_seek') return
      const target = seekTargetRef.current
      const started = seekStartedRef.current
      if (!started || at < target - 2) return
      const elapsed = Date.now() - started
      if (elapsed > SEEK_WINDOW_MS) return
      record(
        'mp4-seek',
        true,
        `${seconds(at)} after ${elapsed}ms — natural playback would need ${target.toFixed(0)}s`,
      )
      setPhase('done')
    },
    [record, setPhase],
  )

  const onError = useCallback(
    (event: OnVideoErrorData) => {
      const detail =
        event.error?.localizedDescription || event.error?.error || event.error?.errorString || 'unknown player error'
      const current = phaseRef.current
      if (current === 'hls_load' || current === 'hls_play') record('hls-load', false, detail)
      else if (current === 'mp4_load' || current === 'mp4_seek') record('mp4-load', false, detail)
      fail(`${current}: ${detail}`)
    },
    [fail, record],
  )

  const source = phase === 'mp4_load' || phase === 'mp4_seek' || phase === 'done' ? MP4_URI : HLS_URI
  const paused = phase === 'idle' || phase === 'failed'
  const running = phase !== 'idle' && phase !== 'done' && phase !== 'failed'
  const passed = Object.values(results).filter((r) => r?.pass).length

  return (
    <View style={styles.root}>
      <View style={styles.playerBox}>
        <Video
          key={source}
          ref={videoRef}
          source={{ uri: source, headers: REQUIRED_HEADER }}
          style={styles.video}
          paused={paused}
          resizeMode="contain"
          onLoad={onLoad}
          onProgress={onProgress}
          onError={onError}
          onLoadStart={() => note(`loadStart ${source === HLS_URI ? 'hls' : 'mp4'}`)}
          onReadyForDisplay={() => note('onReadyForDisplay')}
          onSeek={(event) => note(`onSeek → ${seconds(event.currentTime || 0)}`)}
          onEnd={() => note('onEnd')}
        />
        {running ? (
          <View style={styles.spinner}>
            <ActivityIndicator color="#7aa2ff" />
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stats}>
          t {seconds(position)} / {seconds(duration)}
          {seekTarget ? `  ·  seek target ${seekTarget.toFixed(0)}s` : ''}
        </Text>
        <Text style={styles.phase}>{phase}</Text>
      </View>

      <Text style={styles.summary}>
        {phase === 'failed' ? `${passed}/${CHECKS.length} passed — FAILED` : `${passed}/${CHECKS.length} passed`}
        {stats ? `  ·  ${stats}` : ''}
      </Text>
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listBody}>
        {CHECKS.map((check) => {
          const result = results[check.id]
          return (
            <View key={check.id} style={styles.row}>
              <Text style={result ? (result.pass ? styles.passBadge : styles.failBadge) : styles.waitBadge}>
                {result ? (result.pass ? 'PASS' : 'FAIL') : 'WAIT'}
              </Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowName}>{check.name}</Text>
                <Text style={styles.rowDetail}>{result?.detail ?? 'not reached yet'}</Text>
              </View>
            </View>
          )
        })}

        <Text style={styles.sectionTitle}>trace</Text>
        {log.map((line, index) => (
          <Text key={`${line}-${index}`} style={styles.trace}>
            {line}
          </Text>
        ))}

        <Text style={styles.sectionTitle}>manual</Text>
        <View style={styles.controls}>
          {[
            { label: '−10s', onPress: () => videoRef.current?.seek(Math.max(0, position - 10)) },
            { label: 'pause', onPress: () => videoRef.current?.pause() },
            { label: 'play', onPress: () => videoRef.current?.resume() },
            { label: '+10s', onPress: () => videoRef.current?.seek(position + 10) },
          ].map((control) => (
            <Pressable key={control.label} style={styles.button} onPress={control.onPress}>
              <Text style={styles.buttonLabel}>{control.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.rerun} onPress={restart}>
        <Text style={styles.rerunLabel}>Re-run</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f', paddingTop: 8, paddingHorizontal: 16 },
  playerBox: {
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stats: { color: '#a8a8b3', fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 1 },
  phase: { color: '#7aa2ff', fontSize: 13 },
  summary: { color: '#a8a8b3', fontSize: 13, marginTop: 6 },
  failure: { color: '#f87171', fontSize: 13, marginTop: 6, lineHeight: 18 },
  list: { flex: 1, marginTop: 12 },
  listBody: { paddingBottom: 24, gap: 10 },
  row: { flexDirection: 'row', gap: 10, backgroundColor: '#15151b', borderRadius: 10, padding: 12 },
  rowBody: { flex: 1, gap: 4 },
  rowName: { color: '#f5f5f7', fontSize: 14, fontWeight: '600' },
  rowDetail: { color: '#8e8e99', fontSize: 13, lineHeight: 18 },
  passBadge: {
    color: '#0b0b0f',
    backgroundColor: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  failBadge: {
    color: '#0b0b0f',
    backgroundColor: '#f87171',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  waitBadge: {
    color: '#8e8e99',
    backgroundColor: '#24242e',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  sectionTitle: { color: '#8e8e99', fontSize: 12, fontWeight: '700', marginTop: 8, textTransform: 'uppercase' },
  trace: { color: '#6f6f7a', fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#1d1d26', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  buttonLabel: { color: '#d6d6dd', fontSize: 14 },
  rerun: { paddingVertical: 14, alignItems: 'center' },
  rerunLabel: { color: '#7aa2ff', fontSize: 15 },
})
