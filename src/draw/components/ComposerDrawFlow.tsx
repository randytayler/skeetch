import {useEffect, useState} from 'react'
import {useLingui} from '@lingui/react/macro'
import {type SkImage} from '@shopify/react-native-skia'
import {nanoid} from 'nanoid/non-secure'

import {logger} from '#/logger'
import * as Toast from '#/components/Toast'
import {DraftGallery} from '#/draw/components/DraftGallery'
import {DrawOverlay} from '#/draw/components/DrawOverlay'
import {type ExportResult} from '#/draw/engine/export'
import {loadSourceImageFromUri} from '#/draw/engine/sourceImage'
import {
  type CanvasSize,
  DEFAULT_CANVAS,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'
import {drawingToSession, listDrafts, loadDraft} from '#/draw/storage/drafts'
import {type DraftIndexEntry} from '#/draw/storage/index'

type Screen = 'loading' | 'gallery' | 'canvas'

/** Everything needed to open the canvas for a new or resumed drawing. */
type CanvasSession = {
  draftId: string
  createdAt: number
  canvas: CanvasSize
  initialStrokes: Stroke[]
  sourcePost?: SourcePost
  sourceImageUri?: string
  backgroundImage?: SkImage | null
}

/** A fresh blank-canvas session. Module-level so the mount effect can create one
 * without depending on a per-render closure. */
function makeBlankSession(): CanvasSession {
  return {
    draftId: nanoid(),
    createdAt: Date.now(),
    canvas: DEFAULT_CANVAS,
    initialStrokes: [],
  }
}

/**
 * The composer's Draw entry point (DESIGN.md §7, §8.1). Opens onto the draft
 * gallery when saved drawings exist, or straight onto a blank canvas the first
 * time. Selecting a draft resumes it; the canvas autosaves throughout, so
 * anything drawn here lands back in the gallery.
 *
 * This wraps the drawing surface rather than the composer touching the gallery
 * directly, so the upstream touchpoint stays a single mounted component.
 */
export function ComposerDrawFlow({
  onAttach,
  onClose,
  onError,
}: {
  onAttach: (result: ExportResult) => void
  onClose: () => void
  onError: (e: unknown) => void
}) {
  const {t: l} = useLingui()
  const [screen, setScreen] = useState<Screen>('loading')
  const [session, setSession] = useState<CanvasSession | null>(null)
  // Whether the flow opened onto the gallery, so Cancel knows whether to return
  // there or dismiss back to the composer.
  const [startedAtGallery, setStartedAtGallery] = useState(false)

  function startNew() {
    setSession(makeBlankSession())
    setScreen('canvas')
  }

  // Decide the landing screen once: gallery if drafts exist, else a blank canvas.
  // Everything referenced here is module- or setter-stable, so no dep array
  // churn and the component stays eligible for React Compiler optimization.
  useEffect(() => {
    let cancelled = false
    void listDrafts().then(list => {
      if (cancelled) return
      if (list.length > 0) {
        setStartedAtGallery(true)
        setScreen('gallery')
      } else {
        setSession(makeBlankSession())
        setScreen('canvas')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function openDraft(entry: DraftIndexEntry) {
    setScreen('loading')
    const drawing = await loadDraft(entry.id)
    if (!drawing) {
      Toast.show(l`That drawing could not be opened.`, {type: 'warning'})
      setScreen('gallery')
      return
    }
    const s = drawingToSession(drawing)

    let backgroundImage: SkImage | null = null
    if (s.sourceImageUri) {
      try {
        backgroundImage = await loadSourceImageFromUri(s.sourceImageUri)
      } catch (e) {
        // The photo copy is gone; open the strokes on a blank canvas of the same
        // size rather than failing the resume outright.
        logger.error('draft source-image resume failed', {
          safeMessage: e instanceof Error ? e.message : String(e),
        })
        Toast.show(
          l`The original image is missing; opening your drawing on a blank canvas.`,
          {
            type: 'warning',
          },
        )
      }
    }

    setSession({
      draftId: drawing.id,
      createdAt: drawing.createdAt,
      canvas: s.canvas,
      initialStrokes: s.strokes,
      sourcePost: s.sourcePost,
      sourceImageUri: s.sourceImageUri,
      backgroundImage,
    })
    setScreen('canvas')
  }

  function onCanvasCancel() {
    if (startedAtGallery) {
      setSession(null)
      setScreen('gallery')
    } else {
      onClose()
    }
  }

  if (screen === 'gallery') {
    return (
      <DraftGallery
        onNew={startNew}
        onSelect={entry => void openDraft(entry)}
        onClose={onClose}
      />
    )
  }

  if (screen === 'canvas' && session) {
    return (
      <DrawOverlay
        canvas={session.canvas}
        backgroundImage={session.backgroundImage}
        initialStrokes={session.initialStrokes}
        persistence={{
          draftId: session.draftId,
          createdAt: session.createdAt,
          sourcePost: session.sourcePost,
          sourceImageUri: session.sourceImageUri,
        }}
        onDone={onAttach}
        onCancel={onCanvasCancel}
        onError={onError}
      />
    )
  }

  // Brief loading state while the draft index or a resumed draft resolves. The
  // gallery renders its own loader, so this is only the first tick.
  return null
}
