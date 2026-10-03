/** Calendar-season helpers shared by hooks and the AniList fallback. */

export type Season = 'winter' | 'spring' | 'summer' | 'fall'

/** Current season derived from the client clock. */
export function getCurrentSeason(): { year: number; season: Season } {
  const now = new Date()
  const month = now.getMonth() // 0-based
  if (month <= 1 || month === 11) return { year: now.getFullYear(), season: 'winter' }
  if (month <= 4) return { year: now.getFullYear(), season: 'spring' }
  if (month <= 7) return { year: now.getFullYear(), season: 'summer' }
  return { year: now.getFullYear(), season: 'fall' }
}
