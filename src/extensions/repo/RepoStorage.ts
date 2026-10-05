/**
 * RepoStorage — persisted repository records (mobile-owned).
 *
 * Shares the extension MMKV instance (`pixi.extensions`) under a `repo.` key
 * prefix, so repositories survive restarts beside the installed extensions they
 * point at — but a corrupt row is dropped rather than breaking the list, and an
 * unavailable native store degrades to a session-only memory mirror (the same
 * contract as `ExtensionStorage`).
 */
import { createMMKV, type MMKV } from 'react-native-mmkv'
import type { RepoRecord } from './types.ts'

const KEY_PREFIX = 'repo.'
const DB_ID = 'pixi.extensions'

let instance: MMKV | null = null
let storeUnavailable = false

function db(): MMKV | null {
  if (storeUnavailable) return null
  if (instance) return instance
  try {
    instance = createMMKV({ id: DB_ID })
    return instance
  } catch {
    storeUnavailable = true
    return null
  }
}

const mirror = new Map<string, RepoRecord>()

function readPersisted(): RepoRecord[] {
  const store = db()
  if (!store) return []
  const out: RepoRecord[] = []
  for (const key of store.getAllKeys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    try {
      const raw = store.getString(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as RepoRecord
      if (parsed && typeof parsed.id === 'string' && Array.isArray(parsed.manifest?.providers)) {
        out.push(parsed)
      }
    } catch {
      /* corrupt row — drop it rather than break the whole list */
    }
  }
  return out
}

export async function listRepos(): Promise<RepoRecord[]> {
  for (const record of readPersisted()) mirror.set(record.id, record)
  return [...mirror.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
}

export async function saveRepo(record: RepoRecord): Promise<void> {
  mirror.set(record.id, record)
  const store = db()
  if (!store) return
  try {
    store.set(KEY_PREFIX + record.id, JSON.stringify(record))
  } catch {
    /* storage full / read-only — the in-memory record still serves this session */
  }
}

export async function removeRepo(id: string): Promise<void> {
  mirror.delete(id)
  const store = db()
  if (!store) return
  try {
    store.remove(KEY_PREFIX + id)
  } catch {
    /* nothing to clean up */
  }
}

/** Drop every stored repository (used by the "remove all extensions" action). */
export async function clearRepos(): Promise<void> {
  const store = db()
  for (const id of mirror.keys()) {
    try {
      store?.remove(KEY_PREFIX + id)
    } catch {
      /* ignore */
    }
  }
  mirror.clear()
}
