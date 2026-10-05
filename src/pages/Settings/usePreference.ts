/**
 * A setting that lives in the preference layer (MMKV).
 *
 * Every panel used to repeat the same four lines — a `useState` seeded from a
 * reader, a writer call inside the change handler — and "Reset settings" then
 * had to re-seed every one of them by hand, which is exactly the kind of list
 * that silently drifts. Here the storage module owns the value and the hook
 * only mirrors it: read once on mount, write on every change, and re-read when
 * the page bumps `resetKey` after wiping the keys, so the controls snap back
 * to their defaults without the page knowing which settings exist.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function usePreference<T>(
  read: () => T,
  write: (value: T) => void,
  /** Bumped by the page after "Reset settings" cleared storage. */
  resetKey: number,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(read)

  // Readers are module-level functions, but keeping them behind a ref lets the
  // reset effect depend on `resetKey` alone instead of on every panel's
  // closure.
  const readRef = useRef(read)
  readRef.current = read

  useEffect(() => {
    setValue(readRef.current())
  }, [resetKey])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      write(next)
    },
    [write],
  )

  return [value, update]
}