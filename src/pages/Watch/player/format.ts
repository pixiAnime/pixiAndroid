/**
 * `formatClock` — the one clock the player draws.
 *
 * It lives apart from `Player` because two leaves render times independently
 * (the scrubber's flanking clocks and its preview card) and neither may import
 * the 1700-line component that owns them. Vidstack's format: `0:00`, `12:04`,
 * `1:02:03`.
 */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  const secondText = String(secs).padStart(2, '0')
  return hours > 0 ? `${hours}:${minuteText}:${secondText}` : `${minuteText}:${secondText}`
}

/** Clamp to the unit interval — every fraction derived from a touch. */
export function clamp01(value: number): number {
  return value > 0 ? (value < 1 ? value : 1) : 0
}

/**
 * `1×` / `1.25×` — the bar badge, the boost chip and every speed row in the
 * settings tree all spell a rate the same way, so the three of them must not be
 * free to drift apart.
 */
export function formatRate(rate: number): string {
  return `${rate}×`
}
