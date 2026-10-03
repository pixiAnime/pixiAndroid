/**
 * Extension-backed playback hooks — the Watch page talks to these, never to
 * the runtime directly. Port of `pixiWeb/src/hooks/useExtensions.ts`.
 *
 *  - sources: fan-out to every enabled streaming extension (isolated errors)
 *  - subtitles: independent aggregation once a stream exists (spec §16)
 *  - AniList id: one cached reverse lookup (MAL → AniList) for request identity
 *
 * The one web-only branch is dropped: the `PIXICLIENT_UNAVAILABLE` → offline
 * dialog (spec §26) has no referent on Android, where every extension request
 * goes straight to the socket (`extensions/runtime/http.ts` marks those codes
 * unreachable) and there is no dialog component to open.
 */
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { anilistIdByMal } from '@/api/anilist/endpoints'
import type { JikanAnime } from '@/api/jikan/types'
import type { FlatSource, FlatSubtitle } from '@/extensions/providers/normalize'
import { buildSourceRequest } from '@/extensions/providers/request'
import { collectSources, type SourceOutcome, type SourcesResult } from '@/extensions/providers/streaming'
import { collectSubtitles, type SubtitleOutcome, type SubtitlesResult } from '@/extensions/providers/subtitles'
import { useExtensionRegistry } from '@/extensions/runtime/ExtensionRegistry'
import { ensureExtensionsHydrated } from '@/extensions/runtime/ExtensionRuntime'
import type { SourceRequest } from '@/extensions/sdk/types'

/** Installed records + storage hydration (idempotent). */
export function useExtensionRecords() {
  const records = useExtensionRegistry((s) => s.records)
  useEffect(() => {
    ensureExtensionsHydrated()
  }, [])
  return records
}

/** Cached MAL → AniList id resolution (null on any failure — never blocking). */
export function useAniListId(malId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['ids', malId],
    queryFn: ({ signal }) => anilistIdByMal(malId, signal),
    enabled: enabled && Number.isFinite(malId) && malId > 0,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  })
}

function useActiveRecords(
  capability: 'streaming' | 'subtitles',
  needsMethod: 'getSources' | 'getSubtitles',
) {
  const records = useExtensionRecords()
  return useMemo(
    () =>
      records
        .filter((r) => r.enabled && r.capabilities[capability] && r.methods[needsMethod])
        .sort((a, b) => a.id.localeCompare(b.id)),
    [records, capability, needsMethod],
  )
}

function useSourceRequest(anime: JikanAnime | undefined, episode: number, activeCount: number) {
  const { data: anilistId } = useAniListId(anime?.mal_id ?? 0, activeCount > 0)
  const idsKey = anilistId ?? -1
  const request = useMemo(
    () => (anime ? buildSourceRequest(anime, episode, anilistId ?? null) : null),
    [anime, episode, anilistId],
  )
  return { request, idsKey }
}

export interface ExtensionSourcesView {
  sources: FlatSource[]
  outcomes: SourceOutcome[]
  /** How many enabled streaming extensions exist (0 → empty-state CTA). */
  enabledCount: number
  isLoading: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export function useExtensionSources(
  anime: JikanAnime | undefined,
  episode: number,
): ExtensionSourcesView {
  const active = useActiveRecords('streaming', 'getSources')
  const { request, idsKey } = useSourceRequest(anime, episode, active.length)
  const ids = active.map((r) => r.id).join(',')

  const query = useQuery<SourcesResult>({
    queryKey: ['ext-sources', anime?.mal_id ?? 0, episode, ids, idsKey],
    queryFn: () => collectSources(request as SourceRequest),
    enabled: Boolean(request) && active.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return {
    sources: query.data?.sources ?? [],
    outcomes: query.data?.outcomes ?? [],
    enabledCount: active.length,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export interface ExtensionSubtitlesView {
  subtitles: FlatSubtitle[]
  outcomes: SubtitleOutcome[]
  enabledCount: number
  isLoading: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

export function useExtensionSubtitles(
  anime: JikanAnime | undefined,
  episode: number,
  options: { enabled: boolean },
): ExtensionSubtitlesView {
  const active = useActiveRecords('subtitles', 'getSubtitles')
  const { request, idsKey } = useSourceRequest(anime, episode, active.length)
  const ids = active.map((r) => r.id).join(',')

  const query = useQuery<SubtitlesResult>({
    queryKey: ['ext-subs', anime?.mal_id ?? 0, episode, ids, idsKey],
    queryFn: () => collectSubtitles(request as SourceRequest),
    enabled: options.enabled && Boolean(request) && active.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return {
    subtitles: query.data?.subtitles ?? [],
    outcomes: query.data?.outcomes ?? [],
    enabledCount: active.length,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
