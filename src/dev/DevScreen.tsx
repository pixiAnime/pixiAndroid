/**
 * M0 dev shell — hosts the device-only spikes (native QuickJS sandbox and
 * native video playback) behind a tab bar.
 *
 * Reached by long-pressing the `π` mark in the header; registered only when
 * `__DEV__`, so none of this ships. Replace freely — it exists so the two
 * native layers could be proven on a device before anything was built on top.
 */
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { SandboxSpikeScreen } from './SandboxSpikeScreen'
import { PlayerSpikeScreen } from './PlayerSpikeScreen'
import { colors, fonts, spacing } from '@/theme'

const TABS = [
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'player', label: 'Player' },
] as const

type TabId = (typeof TABS)[number]['id']

export function DevScreen() {
  const [tab, setTab] = useState<TabId>('sandbox')

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === entry.id }}
            style={[styles.tab, tab === entry.id && styles.tabActive]}
            onPress={() => setTab(entry.id)}>
            <Text style={[styles.tabLabel, tab === entry.id && styles.tabLabelActive]}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'sandbox' ? <SandboxSpikeScreen /> : null}
      {tab === 'player' ? <PlayerSpikeScreen /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.card },
  tabActive: { backgroundColor: '#2b2b3a' },
  tabLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.mutedForeground },
  tabLabelActive: { color: colors.foreground },
})
