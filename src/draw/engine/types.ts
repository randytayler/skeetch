/**
 * Drawing engine data model (DESIGN.md §5).
 *
 * The stroke list is the single source of truth: it backs rendering, undo,
 * draft persistence, and (later) timelapse export. Coordinates are stored in
 * canvas space, never screen space, so pan/zoom cannot corrupt stored data.
 */

export type Point = {
  x: number // canvas-space
  y: number
  p: number // pressure, 0..1. Defaults to 1.0 when the device reports none.
  t: number // ms since stroke start. Unused in v1; enables timelapse later.
}

export type BrushMode = 'draw' | 'erase'

export type Brush = {
  color: string // hex
  size: number // px at 1.0 pressure
  opacity: number // 0..1
  mode: BrushMode
}

export type Stroke = {
  id: string
  brush: Brush
  points: Point[]
  seed: number // for any RNG-based brush; guarantees identical replay
}

export type LayerKind = 'image' | 'ink'

export type Layer = {
  id: string
  kind: LayerKind
  locked: boolean
  imageUri?: string // kind: 'image' — local cached copy
  strokes: Stroke[] // kind: 'ink'
}

export type SourcePost = {
  uri: string
  cid: string
  authorHandle: string
}

export type Drawing = {
  id: string
  createdAt: number
  updatedAt: number
  width: number // canvas dimensions, fixed at creation
  height: number
  layers: Layer[]
  // Provenance, when drawing on someone else's image.
  sourcePost?: SourcePost
}

export type CanvasSize = {
  width: number
  height: number
}

/** Longest edge of any canvas, in px. */
export const MAX_CANVAS_EDGE = 2048

/** Blank-canvas drawings have no source image to match, so they stay square. */
export const DEFAULT_CANVAS: CanvasSize = {
  width: MAX_CANVAS_EDGE,
  height: MAX_CANVAS_EDGE,
}

/**
 * Canvas dimensions for drawing over a source image (§13): match the source's
 * aspect ratio so the photo fills the canvas exactly — no letterboxing, no
 * distortion — with the long edge capped so a panorama can't allocate a huge
 * surface (a 2048² RGBA frame is already ~16MB, per §6.4).
 */
export function canvasForImage(width: number, height: number): CanvasSize {
  if (width <= 0 || height <= 0) return DEFAULT_CANVAS
  const scale = Math.min(1, MAX_CANVAS_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
