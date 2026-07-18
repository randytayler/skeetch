/**
 * Convert between the live drawing session and the persisted `Drawing`
 * (DESIGN.md §5, §7).
 *
 * The engine's live state is deliberately flat - a single stroke list plus an
 * optional locked source photo - because that is all v1 can produce (§6.5). The
 * persisted `Drawing`, by contrast, is the full layered model the design commits
 * to, so a v2 with multiple ink layers or timelapse data can read v1 drafts
 * without a migration. This module is the one place that bridges the two, and it
 * is pure (no React, no Skia, no filesystem) so the mapping is unit-testable.
 */

import {
  type CanvasSize,
  type Drawing,
  type Layer,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'

/**
 * Bumped whenever the persisted shape changes. Mirrors the `persistedVersion`
 * convention used by the query layer: a draft written under an older version is
 * discarded rather than misread (see `drafts.ts`).
 */
export const DRAFT_SCHEMA_VERSION = 1

/** On-disk wrapper. The version lives outside `drawing` so it survives even if
 * the `Drawing` shape itself changes. */
export type DraftFile = {
  version: number
  drawing: Drawing
}

/**
 * The engine-facing view of a draft: everything needed to seed a drawing
 * surface, with layers already resolved into their v1 roles. `sourceImageUri`
 * is the local copy of the source photo (layer 0), absent for blank canvases.
 */
export type DrawingSession = {
  strokes: Stroke[]
  canvas: CanvasSize
  sourcePost?: SourcePost
  sourceImageUri?: string
}

export type DrawingMeta = {
  id: string
  createdAt: number
  updatedAt: number
}

function makeLayerId(drawingId: string, kind: Layer['kind']): string {
  return `${drawingId}-${kind}`
}

/**
 * Assemble a persistable `Drawing` from live session state. A source photo, if
 * present, becomes locked layer 0; the strokes become the ink layer above it.
 * Layer order is background-first so it matches paint order on load and export.
 */
export function sessionToDrawing(
  session: DrawingSession,
  meta: DrawingMeta,
): Drawing {
  const layers: Layer[] = []
  if (session.sourceImageUri) {
    layers.push({
      id: makeLayerId(meta.id, 'image'),
      kind: 'image',
      locked: true,
      imageUri: session.sourceImageUri,
      strokes: [],
    })
  }
  layers.push({
    id: makeLayerId(meta.id, 'ink'),
    kind: 'ink',
    locked: false,
    strokes: session.strokes,
  })

  return {
    id: meta.id,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    width: session.canvas.width,
    height: session.canvas.height,
    layers,
    ...(session.sourcePost ? {sourcePost: session.sourcePost} : {}),
  }
}

/**
 * Flatten a persisted `Drawing` back into the engine-facing session view. The
 * ink layer's strokes and the (optional) image layer's local URI are pulled out
 * into their v1 roles; any extra layers a future version might add are ignored
 * here rather than dropped from disk.
 */
export function drawingToSession(drawing: Drawing): DrawingSession {
  const imageLayer = drawing.layers.find(l => l.kind === 'image')
  const inkLayer = drawing.layers.find(l => l.kind === 'ink')
  return {
    strokes: inkLayer?.strokes ?? [],
    canvas: {width: drawing.width, height: drawing.height},
    ...(drawing.sourcePost ? {sourcePost: drawing.sourcePost} : {}),
    ...(imageLayer?.imageUri ? {sourceImageUri: imageLayer.imageUri} : {}),
  }
}
