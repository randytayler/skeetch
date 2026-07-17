/**
 * Flatten a drawing to an image file (DESIGN.md §6.6).
 *
 * The result is a plain PNG on disk whose `file://` URI is handed to the
 * composer as a normal image attachment — no custom lexicon, no stroke data on
 * the network (§2). This is the last point where stroke data exists; everything
 * downstream is just an image upload.
 *
 * Uses the current expo-file-system API (`File`/`Paths`), which writes bytes
 * directly and avoids the base64 round-trip the legacy API requires. The
 * emitted `file://` URI is the same shape the existing upload path consumes.
 */

import {Directory, File, Paths} from 'expo-file-system'
import {ImageFormat, Skia} from '@shopify/react-native-skia'

import {rasterizeStrokes} from './render'
import {type Stroke} from './types'

/** Cache subdirectory for flattened drawings, relative to Paths.cache. */
const EXPORT_DIR = 'skeetch'

/** JPEG quality when exporting photo-backed drawings. Ignored for PNG. */
const JPEG_QUALITY = 90

export type ExportFormat = 'png' | 'jpeg'

export type ExportResult = {
  uri: string
  width: number
  height: number
  format: ExportFormat
}

export type ExportOptions = {
  /**
   * Canvas background painted under the ink. Blank-canvas drawings export on
   * white so the PNG matches what the user drew on; passing null keeps the
   * background transparent (for compositing over a source image layer).
   */
  background?: string | null
  /**
   * PNG preserves ink crisply for blank-canvas drawings. JPEG is smaller and
   * preferable once a photo layer exists (§6.6).
   */
  format?: ExportFormat
}

/**
 * Flatten strokes to an image file at full canvas resolution and return its
 * URI. Synchronous: the current expo-file-system write API is sync, and the
 * encode is a one-shot cost on an explicit user action.
 */
export function exportDrawing(
  strokes: Stroke[],
  canvasSize: number,
  options: ExportOptions = {},
): ExportResult {
  const {background = '#ffffff', format = 'png'} = options

  /*
   * Ink is rasterized onto its own transparent surface first. Erase strokes
   * composite with BlendMode.Clear, so they must only ever clear ink — painting
   * the background first would let the eraser punch holes straight through it.
   */
  const ink = rasterizeStrokes(strokes, canvasSize, canvasSize)
  if (!ink) {
    throw new Error('exportDrawing: could not allocate an offscreen surface')
  }

  let image = ink
  if (background) {
    const surface = Skia.Surface.MakeOffscreen(canvasSize, canvasSize)
    if (!surface) {
      throw new Error('exportDrawing: could not allocate a compositing surface')
    }
    const canvas = surface.getCanvas()
    canvas.drawColor(Skia.Color(background))
    canvas.drawImage(ink, 0, 0)
    surface.flush()
    image = surface.makeImageSnapshot()
  }

  const bytes = image.encodeToBytes(
    format === 'jpeg' ? ImageFormat.JPEG : ImageFormat.PNG,
    format === 'jpeg' ? JPEG_QUALITY : 100,
  )
  if (!bytes) {
    throw new Error(`exportDrawing: failed to encode ${format}`)
  }

  const dir = new Directory(Paths.cache, EXPORT_DIR)
  if (!dir.exists) {
    dir.create({intermediates: true})
  }
  const file = new File(dir, `drawing-${Date.now()}.${format}`)
  if (file.exists) {
    file.delete()
  }
  file.create()
  file.write(bytes)

  return {uri: file.uri, width: canvasSize, height: canvasSize, format}
}

/**
 * Delete previously exported files. The composer copies the image it uploads,
 * so exports are disposable once handed off.
 */
export function clearExports(): void {
  const dir = new Directory(Paths.cache, EXPORT_DIR)
  if (dir.exists) {
    dir.delete()
  }
}
