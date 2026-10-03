/**
 * Minimal dotted-version compare — no dependency, no ranges.
 * Returns >0 when a is newer, 0 when equal, <0 when b is newer.
 * Non-numeric segments compare as 0 (length wins), which is enough to
 * decide "is there an update available?" for manifest versions.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0)
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}
