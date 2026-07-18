/**
 * Autosave coordinator for a live drawing session (DESIGN.md §7).
 *
 * The drawing lives in memory; this hook checkpoints it to disk on the three
 * triggers the design calls for:
 *
 *   - Debounced 2s while drawing. The timer resets on each committed stroke and
 *     fires once the user pauses, bounding crash loss to a couple of seconds
 *     without hammering the filesystem.
 *   - Immediately when the app backgrounds. Android may kill the process any
 *     time after that, so it's the last guaranteed chance to write.
 *   - On unmount (Done or Cancel), so the gallery reflects the final state -
 *     drafts are persistent and kept on both exits.
 *
 * An empty canvas is never written, so tapping Draw and backing out leaves no
 * junk draft behind.
 */

import {useCallback, useEffect, useRef} from 'react'
import {type SkImage} from '@shopify/react-native-skia'

import {useOnAppStateChange} from '#/lib/appState'
import {logger} from '#/logger'
import {
  type CanvasSize,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'
import {saveDraft} from './drafts'

const DEBOUNCE_MS = 2000

export type UseDraftParams = {
  /** Stable id for this session: freshly generated, or the resumed draft's id. */
  draftId: string
  createdAt: number
  strokes: Stroke[]
  canvas: CanvasSize
  sourcePost?: SourcePost
  sourceImageUri?: string
  backgroundImage?: SkImage | null
  /** Off for the dev harness, which has nowhere to resume a draft to. */
  enabled: boolean
}

export function useDraft(params: UseDraftParams) {
  // Always hold the freshest values so a save flush reads current state even
  // when triggered from an AppState listener or an unmount cleanup.
  const latest = useRef(params)
  latest.current = params

  const saving = useRef(false)
  const dirty = useRef(false)

  /*
   * Stable across renders (it only touches refs) so the AppState subscription
   * and unmount cleanup below don't re-run every render. This is the effect-dep
   * exception to the "no proactive useCallback" rule.
   */
  const flush = useCallback(async () => {
    const p = latest.current
    if (!p.enabled || p.strokes.length === 0) return
    if (saving.current) {
      dirty.current = true
      return
    }
    saving.current = true
    try {
      do {
        dirty.current = false
        const cur = latest.current
        await saveDraft({
          id: cur.draftId,
          createdAt: cur.createdAt,
          strokes: cur.strokes,
          canvas: cur.canvas,
          sourcePost: cur.sourcePost,
          sourceImageUri: cur.sourceImageUri,
          backgroundImage: cur.backgroundImage,
        })
      } while (dirty.current)
    } catch (e) {
      logger.error('draft autosave failed', {
        safeMessage: e instanceof Error ? e.message : String(e),
      })
    } finally {
      saving.current = false
    }
  }, [])

  // Debounced save: strokes gets a new identity on every committed stroke,
  // undo, redo, and clear, so any of them reschedules.
  useEffect(() => {
    if (!params.enabled || params.strokes.length === 0) return
    const timer = setTimeout(() => void flush(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [params.strokes, params.enabled, flush])

  useOnAppStateChange(
    useCallback(
      (state: string) => {
        if (state === 'background' || state === 'inactive') {
          void flush()
        }
      },
      [flush],
    ),
  )

  // Final checkpoint when the surface closes (Done or Cancel). Fire-and-forget:
  // the FS/AsyncStorage writes outlive the unmounting component.
  useEffect(() => {
    return () => void flush()
  }, [flush])
}
