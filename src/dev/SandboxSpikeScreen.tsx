/**
 * Dev-only screen that runs the M0 sandbox spike and prints a pass/fail
 * report. It exists so the native sandbox can be verified on a real device
 * or emulator before any of the app shell is built around it — see
 * `sandboxSpike.ts` for what each line proves.
 */
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'

import { runSandboxSpike, type SpikeReport } from './sandboxSpike'

type State =
  | { phase: 'running' }
  | { phase: 'done'; report: SpikeReport }
  | { phase: 'crashed'; message: string }

export function SandboxSpikeScreen(): React.JSX.Element {
  const [state, setState] = useState<State>({ phase: 'running' })

  const run = useCallback(() => {
    setState({ phase: 'running' })
    runSandboxSpike().then(
      (report) => setState({ phase: 'done', report }),
      (error: unknown) =>
        setState({
          phase: 'crashed',
          message: error instanceof Error ? error.message : String(error),
        }),
    )
  }, [])

  useEffect(run, [run])

  return (
    <View style={styles.root}>
      <Text style={styles.title}>M0 · sandbox spike</Text>
      {state.phase === 'running' ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Booting extensions in QuickJS…</Text>
        </View>
      ) : null}
      {state.phase === 'crashed' ? (
        <View style={styles.center}>
          <Text style={styles.failTitle}>The spike itself crashed</Text>
          <Text style={styles.muted}>{state.message}</Text>
        </View>
      ) : null}
      {state.phase === 'done' ? (
        <>
          <Text style={styles.summary}>
            {state.report.passed}/{state.report.results.length} passed ·{' '}
            {(state.report.durationMs / 1000).toFixed(1)}s
          </Text>
          <ScrollView contentContainerStyle={styles.list}>
            {state.report.results.map((result) => (
              <View key={result.name} style={styles.row}>
                <Text style={result.pass ? styles.passBadge : styles.failBadge}>
                  {result.pass ? 'PASS' : 'FAIL'}
                </Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{result.name}</Text>
                  <Text style={styles.rowDetail}>{result.detail}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
      <Text style={styles.retry} onPress={run}>
        Re-run
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f', paddingTop: 8, paddingHorizontal: 16 },
  title: { color: '#f5f5f7', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  summary: { color: '#a8a8b3', fontSize: 14, marginBottom: 12 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  list: { paddingBottom: 32, gap: 10 },
  row: { flexDirection: 'row', gap: 10, backgroundColor: '#15151b', borderRadius: 10, padding: 12 },
  rowBody: { flex: 1, gap: 4 },
  rowName: { color: '#f5f5f7', fontSize: 15, fontWeight: '600' },
  rowDetail: { color: '#8e8e99', fontSize: 13, lineHeight: 18 },
  passBadge: { color: '#0b0b0f', backgroundColor: '#4ade80', fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' },
  failBadge: { color: '#0b0b0f', backgroundColor: '#f87171', fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', alignSelf: 'flex-start' },
  muted: { color: '#8e8e99', fontSize: 13 },
  failTitle: { color: '#f87171', fontSize: 15, fontWeight: '600' },
  retry: { color: '#7aa2ff', fontSize: 15, textAlign: 'center', paddingVertical: 16 },
})
