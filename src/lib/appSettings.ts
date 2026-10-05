/**
 * App-level settings actions — the imperative half of the Settings page
 * (mobile-owned).
 *
 * Everything here is called from an explicit, confirmed user action:
 * clearing cached metadata, uninstalling every extension, or restoring
 * settings to defaults. It deliberately never touches watch history, My List
 * or recently-viewed — those have their own dedicated actions.
 */
import { getLocalStorage } from '@/platform/storage/localStorage'
import { QUERY_CACHE_STORAGE_KEY, queryClient } from '@/lib/queryClient'
import { useExtensionRegistry } from '@/extensions/runtime/ExtensionRegistry'
import { useRepoRegistry } from '@/extensions/repo/RepoRegistry'

const AUTO_CHECK_KEY = 'pixiandroid.extensions.autoCheck'

function read(key: string): string | null {
  try {
    return getLocalStorage().getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    getLocalStorage().setItem(key, value)
  } catch {
    /* storage unavailable — the setting still applies for this session */
  }
}

/** Refresh repository manifests when the Extensions page opens. Off by default. */
export function readAutoCheckUpdates(): boolean {
  return read(AUTO_CHECK_KEY) === 'true'
}

export function writeAutoCheckUpdates(value: boolean): void {
  write(AUTO_CHECK_KEY, value ? 'true' : 'false')
}

/** Drop the persisted + in-memory anime metadata cache. */
export function clearMetadataCache(): void {
  queryClient.clear()
  try {
    getLocalStorage().removeItem(QUERY_CACHE_STORAGE_KEY)
  } catch {
    /* nothing persisted to remove */
  }
}

/** Uninstall every extension and remove every repository. */
export async function clearAllExtensions(): Promise<void> {
  const registry = useExtensionRegistry.getState()
  for (const record of [...registry.records]) {
    await registry.remove(record.id)
  }
  await useRepoRegistry.getState().removeAll()
}

/** Every app-owned preference key the "Reset settings" action clears. */
const SETTINGS_PREFIX = 'pixiandroid.'

/** Restore app settings to defaults. History / My List / recently-viewed stay. */
export function resetAppSettings(): void {
  const store = getLocalStorage()
  try {
    for (const key of store.getAllKeys()) {
      if (key.startsWith(SETTINGS_PREFIX)) store.removeItem(key)
    }
  } catch {
    /* storage unavailable — nothing to reset */
  }
}
