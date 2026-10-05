/**
 * RepoRegistry — the reactive list of added repositories (mobile-owned).
 *
 * Mirrors `ExtensionRegistry`: storage is the source of truth, this store
 * mirrors it for the UI, and repositories are refreshed (manifest re-fetched)
 * on demand or when the Extensions page opens with auto-check enabled.
 */
import { create } from 'zustand'
import { inspectRepository } from './RepoLoader.ts'
import { clearRepos, listRepos, removeRepo, saveRepo } from './RepoStorage.ts'
import type { RepoRecord } from './types.ts'

interface RepoRegistryState {
  repos: RepoRecord[]
  hydrated: boolean
  hydrate: () => Promise<void>
  add: (url: string) => Promise<RepoRecord>
  remove: (id: string) => Promise<void>
  refresh: (id: string) => Promise<RepoRecord>
  removeAll: () => Promise<void>
}

let hydrateInFlight: Promise<void> | null = null

function sortRepos(repos: RepoRecord[]): RepoRecord[] {
  return [...repos].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}

export const useRepoRegistry = create<RepoRegistryState>((set, get) => ({
  repos: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    if (!hydrateInFlight) {
      hydrateInFlight = listRepos()
        .then((repos) => set({ repos, hydrated: true }))
        .catch(() => {
          hydrateInFlight = null
          set({ hydrated: true })
        })
    }
    return hydrateInFlight
  },

  add: async (url) => {
    const inspected = await inspectRepository(url)
    const existing = get().repos.find((r) => r.id === inspected.url)
    const record: RepoRecord = {
      id: inspected.url,
      url: inspected.url,
      manifest: inspected.manifest,
      addedAt: existing?.addedAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await saveRepo(record)
    set((state) => ({ repos: sortRepos([...state.repos.filter((r) => r.id !== record.id), record]) }))
    return record
  },

  remove: async (id) => {
    await removeRepo(id)
    set((state) => ({ repos: state.repos.filter((r) => r.id !== id) }))
  },

  refresh: async (id) => {
    const current = get().repos.find((r) => r.id === id)
    if (!current) throw new Error('Repository not found')
    const inspected = await inspectRepository(current.url)
    const record: RepoRecord = {
      ...current,
      manifest: inspected.manifest,
      updatedAt: Date.now(),
    }
    await saveRepo(record)
    set((state) => ({ repos: sortRepos(state.repos.map((r) => (r.id === id ? record : r))) }))
    return record
  },

  removeAll: async () => {
    await clearRepos()
    set({ repos: [] })
  },
}))

/** Enabled/hydration helper for the Extensions page. */
export function ensureReposHydrated(): Promise<void> {
  return useRepoRegistry.getState().hydrate()
}
