/**
 * EpisodesSheet — the episode list, brought up over the picture.
 *
 * The page already renders `EpisodeList` below the player, but "jump to
 * episode 7" from inside the player used to mean leaving the surface: collapse
 * fullscreen, scroll past the title block, find the list, tap, and come back.
 * This puts the same component — not a second implementation of it — one tap
 * from any frame, which is the "full episode nav in player" the redesign asks
 * for.
 *
 * ## Why the component is *reused* rather than re-implemented
 *
 * `EpisodeList` carries two behaviours that took real work to get right: it
 * reports every row's box through `onLayout` and scrolls the selected row the
 * exact distance to bring it into view (RN has no `scrollIntoView`), and it
 * uses a plain `ScrollView` *precisely so* it can sit inside another one
 * without the nested-VirtualizedList warning. Both are properties of the list,
 * not of where it is mounted — so it is passed straight through `Sheet`'s own
 * scroll body and neither is re-derived here.
 *
 * The `Modal` matters twice over: it can never become an ancestor of
 * `<Video>`, and it owns the Android back key, so back closes the sheet
 * before it touches the player.
 */
import { EpisodeList } from '../../EpisodeList'
import type { Episode } from '@/providers/episode'

import { Sheet } from './Sheet'

export interface EpisodesSheetProps {
  visible: boolean
  /** Sheet heading — `playerWord('episodes')`, so it speaks for itself. */
  title: string
  episodes: Episode[]
  currentEpisode: number
  watched: Set<number>
  /** The list has not arrived yet — same state the page shows inline. */
  isLoading?: boolean
  onSelect: (episodeNumber: number) => void
  onClose: () => void
}

export function EpisodesSheet({
  visible,
  title,
  episodes,
  currentEpisode,
  watched,
  isLoading,
  onSelect,
  onClose,
}: EpisodesSheetProps) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <EpisodeList
        currentEpisode={currentEpisode}
        episodes={episodes}
        isLoading={isLoading}
        onSelect={onSelect}
        watched={watched}
      />
    </Sheet>
  )
}
