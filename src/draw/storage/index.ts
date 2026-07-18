/**
 * Draft index (DESIGN.md §7).
 *
 * A lightweight list of every saved draft, kept in AsyncStorage so the gallery
 * renders instantly without scanning the filesystem or parsing every draft's
 * JSON. The full `Drawing` and its images live on disk (see `drafts.ts`); this
 * holds only what the gallery grid needs to show a card.
 *
 * The index is the authority for what to display, but disk is the authority for
 * what exists: `drafts.ts` reconciles the two on load so a crash mid-write can
 * never strand a card pointing at a missing file.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const INDEX_KEY = 'skeetch:drafts:index'

export type DraftIndexEntry = {
  id: string
  updatedAt: number
  /** Local PNG shown on the gallery card. */
  thumbnailUri: string
  /** Canvas dimensions, so the card can reserve the right aspect ratio. */
  width: number
  height: number
  /** True when the draft was started from someone else's image (§8.2). */
  hasSource: boolean
}

/** Read the index, newest first. Returns an empty list if unset or corrupt. */
export async function readDraftIndex(): Promise<DraftIndexEntry[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return sortNewestFirst(parsed as DraftIndexEntry[])
  } catch {
    /*
     * A corrupt index is recoverable - the JSON files on disk are the real
     * data - so treat it as empty and let the next save rewrite it.
     */
    return []
  }
}

async function writeDraftIndex(entries: DraftIndexEntry[]): Promise<void> {
  await AsyncStorage.setItem(
    INDEX_KEY,
    JSON.stringify(sortNewestFirst(entries)),
  )
}

/** Insert or replace a draft's entry and persist the index. */
export async function upsertDraftIndexEntry(
  entry: DraftIndexEntry,
): Promise<void> {
  const entries = await readDraftIndex()
  const next = entries.filter(e => e.id !== entry.id)
  next.push(entry)
  await writeDraftIndex(next)
}

/** Drop a draft's entry. No-op if it was not present. */
export async function removeDraftIndexEntry(id: string): Promise<void> {
  const entries = await readDraftIndex()
  const next = entries.filter(e => e.id !== id)
  if (next.length !== entries.length) {
    await writeDraftIndex(next)
  }
}

/** Replace the whole index. Used by reconciliation in `drafts.ts`. */
export async function replaceDraftIndex(
  entries: DraftIndexEntry[],
): Promise<void> {
  await writeDraftIndex(entries)
}

function sortNewestFirst(entries: DraftIndexEntry[]): DraftIndexEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt)
}
