/**
 * Recently viewed anime — separate from watch history, capped at 25 entries
 * to keep storage small.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RecentlyViewedEntry } from './types'

const MAX_ENTRIES = 25

interface RecentlyViewedState {
  entries: RecentlyViewedEntry[]
  recordView: (entry: Omit<RecentlyViewedEntry, 'viewedAt'>) => void
  remove: (animeId: number) => void
  clear: () => void
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      entries: [],

      recordView: (entry) =>
        set((state) => {
          const without = state.entries.filter((e) => e.animeId !== entry.animeId)
          return {
            entries: [{ ...entry, viewedAt: Date.now() }, ...without].slice(0, MAX_ENTRIES),
          }
        }),

      remove: (animeId) =>
        set((state) => ({ entries: state.entries.filter((e) => e.animeId !== animeId) })),

      clear: () => set({ entries: [] }),
    }),
    { name: 'pixiweb.recently-viewed', version: 1 },
  ),
)
