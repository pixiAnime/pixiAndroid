/**
 * `localStorage` for React Native, backed by MMKV.
 *
 * The shared stores (`favoritesStore`, `historyStore`, `recentlyViewedStore`)
 * and the query-cache hydration layer are written against the web's
 * `localStorage` and are synced verbatim from the web project. Rather than
 * fork them, we install a compatible implementation on `globalThis` so
 * hydration behaves *exactly* as it does in the browser — synchronous reads
 * at module load, before the first render.
 *
 * Import this module for its side effect from `index.js`, BEFORE anything
 * that imports a persisted store. MMKV is opened lazily on first access, so
 * the native side only has to be ready by the time a store hydrates.
 */
import { createMMKV, type MMKV } from 'react-native-mmkv'

/** The subset of the `Storage` contract our callers actually use. */
export interface WebLikeStorage {
  readonly length: number
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  getAllKeys(): string[]
}

let instance: MMKV | null = null

function store(): MMKV {
  if (instance === null) instance = createMMKV({ id: 'pixi.storage' })
  return instance
}

function createLocalStorage(): WebLikeStorage {
  return {
    get length(): number {
      return store().length
    },
    getItem(key: string): string | null {
      return store().getString(key) ?? null
    },
    setItem(key: string, value: string): void {
      store().set(key, String(value))
    },
    removeItem(key: string): void {
      store().remove(key)
    },
    clear(): void {
      store().clearAll()
    },
    key(index: number): string | null {
      const keys = store().getAllKeys()
      return index >= 0 && index < keys.length ? keys[index] : null
    },
    getAllKeys(): string[] {
      return store().getAllKeys()
    },
  }
}

let fallback: WebLikeStorage | null = null

/**
 * Install the shim if nothing else provides `localStorage`.
 * Idempotent — safe to call from tests or multiple entry points.
 */
export function installLocalStorage(): WebLikeStorage {
  const target = globalThis as { localStorage?: unknown }
  const existing = target.localStorage
  if (existing && typeof (existing as WebLikeStorage).getItem === 'function') {
    return existing as WebLikeStorage
  }
  fallback ??= createLocalStorage()
  target.localStorage = fallback
  return fallback
}

/** Typed accessor — throws nothing, degrades to a memory-less shim never. */
export function getLocalStorage(): WebLikeStorage {
  const existing = (globalThis as { localStorage?: unknown }).localStorage
  if (existing && typeof (existing as WebLikeStorage).getItem === 'function') {
    return existing as WebLikeStorage
  }
  return installLocalStorage()
}

// Self-install on import — see the module docstring.
installLocalStorage()
