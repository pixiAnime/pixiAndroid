/** Favorites / My List — localStorage persisted. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FavoriteEntry } from './types'

interface FavoritesState {
  favorites: FavoriteEntry[]
  toggle: (entry: Omit<FavoriteEntry, 'addedAt'>) => void
  remove: (animeId: number) => void
  has: (animeId: number) => boolean
  clear: () => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      toggle: (entry) =>
        set((state) => {
          const exists = state.favorites.some((f) => f.animeId === entry.animeId)
          if (exists) {
            return { favorites: state.favorites.filter((f) => f.animeId !== entry.animeId) }
          }
          return { favorites: [{ ...entry, addedAt: Date.now() }, ...state.favorites] }
        }),

      remove: (animeId) =>
        set((state) => ({ favorites: state.favorites.filter((f) => f.animeId !== animeId) })),

      has: (animeId) => get().favorites.some((f) => f.animeId === animeId),

      clear: () => set({ favorites: [] }),
    }),
    { name: 'pixiweb.favorites', version: 1 },
  ),
)

export function selectIsFavorite(favorites: FavoriteEntry[], animeId: number): boolean {
  return favorites.some((f) => f.animeId === animeId)
}
