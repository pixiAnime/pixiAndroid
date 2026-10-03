/**
 * ExtensionRegistry — the reactive list of installed extensions (spec §20).
 * Source of truth is IndexedDB; this store mirrors it for the UI and the
 * runtime (which disposes sandboxes when records change).
 */
import { create } from 'zustand'
import {
  listRecords,
  removeRecord,
  saveRecord,
  type ExtensionRecord,
} from '../storage/ExtensionStorage.ts'

export type { ExtensionRecord }

interface ExtensionRegistryState {
  records: ExtensionRecord[]
  hydrated: boolean
  hydrate: () => Promise<void>
  upsert: (record: ExtensionRecord) => Promise<void>
  setEnabled: (id: string, enabled: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
}

const byId = (records: ExtensionRecord[], id: string): ExtensionRecord[] =>
  records.map((r) => (r.id === id ? { ...r } : r)).sort((a, b) => a.id.localeCompare(b.id))

let hydrateInFlight: Promise<void> | null = null

export const useExtensionRegistry = create<ExtensionRegistryState>((set, get) => ({
  records: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    if (!hydrateInFlight) {
      hydrateInFlight = listRecords()
        .then((records) => {
          set({ records, hydrated: true })
        })
        .catch(() => {
          // Storage unreadable → start empty rather than break the page.
          hydrateInFlight = null
          set({ hydrated: true })
        })
    }
    return hydrateInFlight
  },

  upsert: async (record) => {
    await saveRecord(record)
    set((state) => {
      const next = state.records.filter((r) => r.id !== record.id)
      next.push(record)
      next.sort((a, b) => a.id.localeCompare(b.id))
      return { records: next }
    })
  },

  setEnabled: async (id, enabled) => {
    const current = get().records.find((r) => r.id === id)
    if (!current || current.enabled === enabled) return
    const next = { ...current, enabled }
    await saveRecord(next)
    set((state) => ({ records: byId(state.records, id).map((r) => (r.id === id ? next : r)) }))
  },

  remove: async (id) => {
    await removeRecord(id)
    set((state) => ({ records: state.records.filter((r) => r.id !== id) }))
  },
}))

/** Enabled extensions offering a capability — deterministic id order. */
export function selectEnabled(
  records: ExtensionRecord[],
  capability: 'streaming' | 'subtitles',
): ExtensionRecord[] {
  return records
    .filter((r) => r.enabled && r.capabilities[capability])
    .sort((a, b) => a.id.localeCompare(b.id))
}
