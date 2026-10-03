/**
 * Watch history — localStorage persisted, capped at 100 episode entries.
 *
 * - entries are per anime+episode (drives watched state in the episode list);
 * - Continue Watching derives "latest episode per anime" via selector;
 * - progress/position are `updateProgress`'s job, and `recordWatch`
 *   *preserves* them when the caller omits them: opening an episode is what
 *   creates the entry, so it must not erase where the viewer stopped — that is
 *   what resume-on-open reads back (`selectEpisodeProgress`).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WatchHistoryEntry } from './types'

const MAX_ENTRIES = 100

export interface HistoryInput {
  animeId: number
  title: string
  titleEnglish?: string | null
  posterUrl?: string | null
  episode: number
  episodeTitle?: string | null
  totalEpisodes?: number | null
  progress?: number
  position?: number
}

interface HistoryState {
  entries: WatchHistoryEntry[]
  recordWatch: (input: HistoryInput) => void
  updateProgress: (animeId: number, episode: number, progress: number, position: number) => void
  removeEntry: (animeId: number, episode?: number) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],

      recordWatch: (input) =>
        set((state) => {
          const now = Date.now()
          const existing = state.entries.find(
            (e) => e.animeId === input.animeId && e.episode === input.episode,
          )
          const updated: WatchHistoryEntry = {
            animeId: input.animeId,
            title: input.title,
            titleEnglish: input.titleEnglish ?? null,
            posterUrl: input.posterUrl ?? null,
            episode: input.episode,
            episodeTitle: input.episodeTitle ?? null,
            totalEpisodes: input.totalEpisodes ?? null,
            lastWatchedAt: now,
            // Re-opening an episode must not erase where the viewer was: a
            // caller that omits progress/position keeps what the previous
            // session recorded, which is what resume-on-open reads.
            progress: input.progress ?? existing?.progress,
            position: input.position ?? existing?.position,
          }

          const withoutSame = state.entries.filter(
            (e) => !(e.animeId === input.animeId && e.episode === input.episode),
          )
          return { entries: [updated, ...withoutSame].slice(0, MAX_ENTRIES) }
        }),

      updateProgress: (animeId, episode, progress, position) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.animeId === animeId && e.episode === episode
              ? { ...e, progress, position, lastWatchedAt: Date.now() }
              : e,
          ),
        })),

      removeEntry: (animeId, episode) =>
        set((state) => ({
          entries:
            episode === undefined
              ? state.entries.filter((e) => e.animeId !== animeId)
              : state.entries.filter((e) => !(e.animeId === animeId && e.episode === episode)),
        })),

      clear: () => set({ entries: [] }),
    }),
    { name: 'pixiweb.history', version: 1 },
  ),
)

/** Most recent entry per anime — the Continue Watching row (newest first). */
export function selectContinueWatching(entries: WatchHistoryEntry[]): WatchHistoryEntry[] {
  const byAnime = new Map<number, WatchHistoryEntry>()
  for (const entry of entries) {
    const existing = byAnime.get(entry.animeId)
    if (!existing || entry.lastWatchedAt > existing.lastWatchedAt) {
      byAnime.set(entry.animeId, entry)
    }
  }
  return [...byAnime.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
}

/** Episode numbers watched for one anime — drives the episode list. */
export function selectWatchedEpisodes(
  entries: WatchHistoryEntry[],
  animeId: number,
): Set<number> {
  const watched = new Set<number>()
  for (const entry of entries) {
    if (entry.animeId === animeId) watched.add(entry.episode)
  }
  return watched
}

/** The most recent entry for one anime (continue point). */
export function selectAnimeHistory(
  entries: WatchHistoryEntry[],
  animeId: number,
): WatchHistoryEntry | undefined {
  let latest: WatchHistoryEntry | undefined
  for (const entry of entries) {
    if (entry.animeId !== animeId) continue
    if (!latest || entry.lastWatchedAt > latest.lastWatchedAt) latest = entry
  }
  return latest
}

/** Saved playback for one episode — what resuming an episode needs. */
export interface EpisodeProgress {
  /** Position in seconds; 0 when the episode has never really played. */
  position: number
  /** Whole percent 0–100 as the player last reported it; 0 when unknown. */
  percent: number
}

/**
 * Where this episode last stopped, or zeros when it never did.
 *
 * A page that only wants the value for the episode it is showing reads this
 * once through `useHistoryStore.getState()` inside a memo keyed on the
 * episode, rather than subscribing to every history write.
 */
export function selectEpisodeProgress(
  entries: WatchHistoryEntry[],
  animeId: number,
  episode: number,
): EpisodeProgress {
  const entry = entries.find((e) => e.animeId === animeId && e.episode === episode)
  const position = entry?.position ?? 0
  const percent = entry?.progress ?? 0
  return {
    position: Number.isFinite(position) && position > 0 ? position : 0,
    percent: Number.isFinite(percent) && percent > 0 ? Math.min(100, percent) : 0,
  }
}
