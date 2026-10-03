/**
 * ExtensionStorage — installed extension records + their compiled source.
 *
 * The web build keeps these in IndexedDB (spec §21: module-sized payloads
 * don't belong in localStorage). Android's equivalent is a dedicated MMKV
 * instance — memory-mapped, synchronous, and separate from the user data the
 * `localStorage` shim exposes, so a corrupt cache never takes extensions
 * down with it.
 *
 * Every read/write also feeds an in-memory mirror, which doubles as the
 * fallback when the native store is unavailable: installs then still work
 * for the current session, they just don't survive a restart.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv'
import type { ExtensionCapabilities, ExtensionManifest } from '../sdk/types.ts'
import type { SandboxMethods } from '../runtime/ExtensionSandbox.ts'

export interface ExtensionRecord {
  id: string
  /** Canonical source URL — the update channel. */
  url: string
  manifest: ExtensionManifest
  capabilities: ExtensionCapabilities
  methods: SandboxMethods
  /** The compiled ES module source (evaluated only inside sandboxes). */
  source: string
  enabled: boolean
  installedAt: number
  updatedAt: number
}

const KEY_PREFIX = 'rec.'
const DB_ID = 'pixi.extensions'

let instance: MMKV | null = null
let storeUnavailable = false

/** Null when the native store can't be opened — sessions stay memory-only. */
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

/** Write-through mirror — keeps the memory fallback coherent with the store. */
const mirror = new Map<string, ExtensionRecord>()

function readPersisted(): ExtensionRecord[] {
  const store = db()
  if (!store) return []
  const out: ExtensionRecord[] = []
  for (const key of store.getAllKeys()) {
    if (!key.startsWith(KEY_PREFIX)) continue
    try {
      const raw = store.getString(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as ExtensionRecord
      if (parsed && typeof parsed.id === 'string' && typeof parsed.source === 'string') out.push(parsed)
    } catch {
      /* corrupt row — drop it rather than break the whole list */
    }
  }
  return out
}

export async function listRecords(): Promise<ExtensionRecord[]> {
  for (const record of readPersisted()) mirror.set(record.id, record)
  return [...mirror.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export async function saveRecord(record: ExtensionRecord): Promise<void> {
  mirror.set(record.id, record)
  const store = db()
  if (!store) return
  try {
    store.set(KEY_PREFIX + record.id, JSON.stringify(record))
  } catch {
    /* storage full / read-only — the in-memory record still serves this session */
  }
}

export async function removeRecord(id: string): Promise<void> {
  mirror.delete(id)
  const store = db()
  if (!store) return
  try {
    store.remove(KEY_PREFIX + id)
  } catch {
    /* nothing to clean up */
  }
}
