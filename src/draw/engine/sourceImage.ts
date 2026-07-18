/**
 * Fetch a post's image to draw over (DESIGN.md §8.2).
 *
 * The blob is copied to a local file before decoding — the same URI it came
 * from may vanish (the post gets deleted, the CDN evicts it), and a local
 * copy is what lets a draft survive that (§7). Nothing about this touches the
 * original poster's data; it's compositing over a copy of a public image, the
 * same as loading it in any browser.
 */

import {Directory, File, Paths} from 'expo-file-system'
import {Skia, type SkImage} from '@shopify/react-native-skia'

import {canvasForImage, type CanvasSize} from './types'

const SOURCE_DIR = 'skeetch/source'

export type SourceImage = {
  image: SkImage
  canvas: CanvasSize
  /** Local copy of the fetched blob, kept alongside the drawing. */
  localUri: string
}

function extensionFor(uri: string): string {
  const match = /\.(jpg|jpeg|png|webp)(?:[?#]|$)/i.exec(uri)
  return match ? match[1].toLowerCase() : 'jpg'
}

/**
 * Download the full-resolution image at `uri` and decode it as layer 0.
 * Throws if the fetch or decode fails — the caller should surface that rather
 * than silently opening a blank canvas over a broken image.
 */
export async function fetchSourceImage(uri: string): Promise<SourceImage> {
  const dir = new Directory(Paths.cache, SOURCE_DIR)
  if (!dir.exists) {
    dir.create({intermediates: true})
  }

  const destination = new File(dir, `src-${Date.now()}.${extensionFor(uri)}`)
  const downloaded = await File.downloadFileAsync(uri, destination, {
    idempotent: true,
  })

  const image = decodeImageBytes(await downloaded.bytes())

  return {
    image,
    canvas: canvasForImage(image.width(), image.height()),
    localUri: downloaded.uri,
  }
}

/**
 * Decode encoded image bytes into an SkImage. Shared by the initial download
 * and by draft resume (§7). Throws if the bytes can't be decoded.
 */
export function decodeImageBytes(bytes: Uint8Array): SkImage {
  const data = Skia.Data.fromBytes(bytes)
  const image = Skia.Image.MakeImageFromEncoded(data)
  if (!image) {
    throw new Error('decodeImageBytes: failed to decode image')
  }
  return image
}

/** Re-decode a draft's persisted source photo from its local URI (§7 resume). */
export async function loadSourceImageFromUri(
  localUri: string,
): Promise<SkImage> {
  return decodeImageBytes(await new File(localUri).bytes())
}
