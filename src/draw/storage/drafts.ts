/**
 * File-based draft persistence (DESIGN.md §7).
 *
 * Each draft is one JSON file holding the full `Drawing`, kept in the document
 * directory (not cache) so the OS never reclaims it. Draw-on-image drafts also
 * keep a local copy of the source photo, so the draft survives even if the
 * original post is deleted. A small thumbnail PNG backs the gallery card.
 *
 *   ${document}/skeetch/drafts/<id>.json        the Drawing
 *   ${document}/skeetch/drafts/<id>.src.<ext>   source photo copy (if any)
 *   ${document}/skeetch/drafts/<id>.thumb.png   gallery thumbnail
 *
 * The live drawing lives in memory; disk is a periodic checkpoint written by
 * `useDraft`. SQLite is deliberately avoided in v1 (§7).
 */

import {Directory, File, Paths} from 'expo-file-system'
import {type SkImage} from '@shopify/react-native-skia'

import {logger} from '#/logger'
import {renderThumbnailBytes} from '#/draw/engine/export'
import {
  type CanvasSize,
  type Drawing,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'
import {
  type DraftIndexEntry,
  readDraftIndex,
  removeDraftIndexEntry,
  replaceDraftIndex,
  upsertDraftIndexEntry,
} from './index'
import {
  DRAFT_SCHEMA_VERSION,
  type DraftFile,
  drawingToSession,
  sessionToDrawing,
} from './serialize'

const DRAFTS_SUBDIR = 'skeetch/drafts'

function draftsDir(): Directory {
  return new Directory(Paths.document, DRAFTS_SUBDIR)
}

function ensureDir(): Directory {
  const dir = draftsDir()
  if (!dir.exists) {
    dir.create({intermediates: true})
  }
  return dir
}

function jsonFile(dir: Directory, id: string): File {
  return new File(dir, `${id}.json`)
}

function thumbFile(dir: Directory, id: string): File {
  return new File(dir, `${id}.thumb.png`)
}

function extensionOf(uri: string): string {
  const match = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(uri)
  return match ? match[1].toLowerCase() : 'jpg'
}

function writeFile(file: File, content: string | Uint8Array): void {
  if (file.exists) {
    file.delete()
  }
  file.create()
  file.write(content)
}

export type SaveDraftInput = {
  id: string
  createdAt: number
  strokes: Stroke[]
  canvas: CanvasSize
  sourcePost?: SourcePost
  /**
   * Current source-image URI: a cache path for a freshly started draw-on-image
   * draft, or the draft's own persisted copy on resume. Undefined for a blank
   * canvas. Copied into the draft folder on first save so it outlives the cache.
   */
  sourceImageUri?: string
  /** In-memory source photo, composited into the thumbnail. */
  backgroundImage?: SkImage | null
}

/**
 * Persist a draft: copy its source photo (once), write the Drawing JSON, render
 * a thumbnail, and update the index. The JSON is written before the thumbnail so
 * a crash mid-save can still lose at most the preview, never the drawing.
 */
export async function saveDraft(
  input: SaveDraftInput,
): Promise<DraftIndexEntry> {
  const dir = ensureDir()
  const updatedAt = Date.now()

  const persistedSourceUri = persistSourceImage(
    dir,
    input.id,
    input.sourceImageUri,
  )

  const drawing = sessionToDrawing(
    {
      strokes: input.strokes,
      canvas: input.canvas,
      sourcePost: input.sourcePost,
      sourceImageUri: persistedSourceUri,
    },
    {id: input.id, createdAt: input.createdAt, updatedAt},
  )

  const file: DraftFile = {version: DRAFT_SCHEMA_VERSION, drawing}
  writeFile(jsonFile(dir, input.id), JSON.stringify(file))

  const thumb = thumbFile(dir, input.id)
  let thumbnailUri = thumb.uri
  try {
    writeFile(
      thumb,
      renderThumbnailBytes(input.strokes, input.canvas, {
        backgroundImage: input.backgroundImage ?? null,
      }),
    )
  } catch (e) {
    // A missing thumbnail only degrades the gallery card, so don't fail the save.
    logger.error('draft thumbnail render failed', {
      safeMessage: e instanceof Error ? e.message : String(e),
    })
    thumbnailUri = thumb.exists ? thumb.uri : ''
  }

  const entry: DraftIndexEntry = {
    id: input.id,
    updatedAt,
    thumbnailUri,
    width: input.canvas.width,
    height: input.canvas.height,
    hasSource: !!persistedSourceUri,
  }
  await upsertDraftIndexEntry(entry)
  return entry
}

/**
 * Copy the source photo into the draft folder on first save and return the
 * persisted URI. On resume the URI already points inside the folder, so this is
 * a no-op. Returns undefined for blank-canvas drafts.
 */
function persistSourceImage(
  dir: Directory,
  id: string,
  sourceImageUri: string | undefined,
): string | undefined {
  if (!sourceImageUri) return undefined

  const dest = new File(dir, `${id}.src.${extensionOf(sourceImageUri)}`)
  if (sourceImageUri === dest.uri || dest.exists) {
    return dest.uri
  }
  try {
    new File(sourceImageUri).copy(dest)
    return dest.uri
  } catch (e) {
    // Without the copy the draft can't be redrawn over its photo later, but the
    // strokes are still worth keeping - persist without a source rather than not
    // at all.
    logger.error('draft source-image copy failed', {
      safeMessage: e instanceof Error ? e.message : String(e),
    })
    return undefined
  }
}

/**
 * Load a draft's `Drawing`, or null if it is missing or was written by an
 * incompatible schema version (in which case it is treated as absent, matching
 * the persistedVersion convention in the query layer).
 */
export async function loadDraft(id: string): Promise<Drawing | null> {
  const file = jsonFile(draftsDir(), id)
  if (!file.exists) return null
  try {
    const parsed = JSON.parse(await file.text()) as DraftFile
    if (parsed.version !== DRAFT_SCHEMA_VERSION) return null
    return parsed.drawing
  } catch (e) {
    logger.error('draft load failed', {
      safeMessage: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

/** Re-export the session view so callers can seed the engine from a Drawing. */
export {drawingToSession}

/**
 * List drafts for the gallery, newest first. Reconciles the index against disk
 * so a card can never point at a draft whose JSON went missing (e.g. a crash
 * between writing the index and the file, or a manual cache wipe).
 */
export async function listDrafts(): Promise<DraftIndexEntry[]> {
  const entries = await readDraftIndex()
  const dir = draftsDir()
  if (!dir.exists) {
    if (entries.length) await replaceDraftIndex([])
    return []
  }
  const live = entries.filter(e => jsonFile(dir, e.id).exists)
  if (live.length !== entries.length) {
    await replaceDraftIndex(live)
  }
  return live
}

/** Delete a draft and all its files (JSON, source copy, thumbnail). */
export async function deleteDraft(id: string): Promise<void> {
  const dir = draftsDir()
  if (dir.exists) {
    for (const entry of dir.list()) {
      if (entry instanceof File && entry.name.startsWith(`${id}.`)) {
        try {
          entry.delete()
        } catch (e) {
          logger.error('draft file delete failed', {
            safeMessage: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }
  }
  await removeDraftIndexEntry(id)
}
