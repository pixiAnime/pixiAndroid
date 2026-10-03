/**
 * Subtitles bucketed by the extension that returned them.
 *
 * The captions list used to be one flat run of chips from every provider, so
 * three extensions' tracks read as one undifferentiated pile — while the
 * sources right above it were already grouped per provider. Both pickers now
 * group the same way, from the same helper, so the two cannot drift.
 *
 * Grouping is by `providerId`, which `normalize.ts` stamps on every track and
 * every source: that is also what lets a provider which appears in *both*
 * lists (Ayruki ships streams and captions) be recognised as one thing rather
 * than two coincidentally equal names.
 *
 * Order is first appearance in the list handed over, and that list is already
 * deterministic: `mergeSubtitles` sorted it by language → label → provider, so
 * this helper re-ranks nothing.
 *
 * Type-only import: this module stays importable from a plain Node test
 * (`tests/subtitleGroups.test.ts`) with no extension runtime attached.
 */
import type { FlatSubtitle } from '@/extensions'

export interface SubtitleProviderGroup {
  providerId: string
  providerName: string
  /** That provider's tracks, in the order the runtime returned them. */
  items: FlatSubtitle[]
}

/** The same buckets, keyed for lookup against a list grouped some other way. */
export function indexSubtitlesByProvider(
  subtitles: readonly FlatSubtitle[],
): Map<string, FlatSubtitle[]> {
  const map = new Map<string, FlatSubtitle[]>()
  for (const subtitle of subtitles) {
    const bucket = map.get(subtitle.providerId)
    if (bucket) bucket.push(subtitle)
    else map.set(subtitle.providerId, [subtitle])
  }
  return map
}

/** Provider groups for the captions section, in first-seen provider order. */
export function groupSubtitlesByProvider(
  subtitles: readonly FlatSubtitle[],
): SubtitleProviderGroup[] {
  const groups: SubtitleProviderGroup[] = []
  let byId: Map<string, SubtitleProviderGroup> | null = null

  for (const subtitle of subtitles) {
    if (!byId) byId = new Map()
    let group = byId.get(subtitle.providerId)
    if (!group) {
      group = {
        providerId: subtitle.providerId,
        providerName: subtitle.providerName,
        items: [],
      }
      byId.set(subtitle.providerId, group)
      groups.push(group)
    }
    group.items.push(subtitle)
  }
  return groups
}
