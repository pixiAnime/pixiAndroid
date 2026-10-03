/** Small formatting helpers shared across the UI (localized via i18n). */
import { i18n } from '@/i18n'

export function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) return '—'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function formatScore(value?: number | null): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(2)
}

/** "2024-04-01T00:00:00+00:00" → "Apr 2024" / "Apr 1, 2024" (active locale). */
export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(i18n.resolvedLanguage ?? 'en', opts)
}

/** "aired.from → aired.to" style range. */
export function formatDateRange(from?: string | null, to?: string | null): string {
  const hasFrom = Boolean(from)
  const hasTo = Boolean(to)
  if (!hasFrom && !hasTo) return '—'
  const start = formatDate(from)
  if (!hasTo) return start
  return `${start} – ${formatDate(to)}`
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return i18n.t('time.justNow')
  if (minutes < 60) return i18n.t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return i18n.t('time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return i18n.t('time.daysAgo', { count: days })
  return formatDate(new Date(timestamp).toISOString())
}

/** Episode number → "01", "12", "100". */
export function padEpisode(n: number): string {
  return String(n).padStart(2, '0')
}
