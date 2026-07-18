import {useState} from 'react'
import {type LayoutChangeEvent, StyleSheet, View} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import {type SkImage} from '@shopify/react-native-skia'

import {Toolbar} from '#/draw/components/Toolbar'
import {exportDrawing, type ExportResult} from '#/draw/engine/export'
import {DrawingCanvas} from '#/draw/engine/render'
import {
  type CanvasSize,
  DEFAULT_CANVAS,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'
import {useDrawingEngine} from '#/draw/engine/useDrawingEngine'
import {useDraft} from '#/draw/storage/useDraft'

/**
 * Identifies the draft a surface autosaves to. Present for real drawing
 * sessions (composer, draw-on-image); absent for the dev harness, which has
 * nowhere to persist.
 */
export type DrawPersistence = {
  draftId: string
  createdAt: number
  sourcePost?: SourcePost
  /** Source-photo URI to copy into the draft folder (§7). */
  sourceImageUri?: string
}

/**
 * The drawing surface: canvas plus controls. Used by the composer's draw
 * overlay and by the dev-only `/sys/draw` harness, so the engine wiring lives
 * in one place.
 *
 * `onDone` receives the flattened image (§6.6); the caller decides what to do
 * with it. Errors are surfaced to the caller rather than swallowed, since a
 * failed export must not look like a successful attach.
 */
export function DrawSurface({
  onDone,
  onCancel,
  onError,
  canvas = DEFAULT_CANVAS,
  backgroundImage,
  initialStrokes,
  persistence,
}: {
  onDone: (result: ExportResult) => void
  onCancel: () => void
  onError?: (e: unknown) => void
  canvas?: CanvasSize
  /** Locked source photo drawn beneath the ink (§8.2). */
  backgroundImage?: SkImage | null
  /** Committed strokes to seed a resumed draft with (§7). */
  initialStrokes?: Stroke[]
  /** When set, the surface autosaves to this draft; omit for the dev harness. */
  persistence?: DrawPersistence
}) {
  const engine = useDrawingEngine(canvas, initialStrokes)
  const [displayScale, setDisplayScale] = useState(0)

  useDraft({
    draftId: persistence?.draftId ?? '',
    createdAt: persistence?.createdAt ?? 0,
    strokes: engine.strokes,
    canvas,
    sourcePost: persistence?.sourcePost,
    sourceImageUri: persistence?.sourceImageUri,
    backgroundImage,
    enabled: !!persistence,
  })

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout
    // Fit the canvas into the available area. Uniform, so nothing is distorted.
    const next = Math.min(width / canvas.width, height / canvas.height)
    setDisplayScale(next)
    engine.setDisplayScale(next)
  }

  const handleDone = () => {
    try {
      onDone(exportDrawing(engine.strokes, engine.canvas, {backgroundImage}))
    } catch (e) {
      onError?.(e)
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.canvasArea} onLayout={onLayout}>
        {displayScale > 0 && (
          <GestureDetector gesture={engine.gesture}>
            <View collapsable={false}>
              <DrawingCanvas
                strokes={engine.strokes}
                livePath={engine.livePath}
                liveBrush={engine.brush}
                canvas={engine.canvas}
                displayScale={displayScale}
                backgroundImage={backgroundImage}
              />
            </View>
          </GestureDetector>
        )}
      </View>
      <Toolbar
        brush={engine.brush}
        canUndo={engine.canUndo}
        canRedo={engine.canRedo}
        hasStrokes={engine.strokes.length > 0}
        onColor={engine.setColor}
        onSize={engine.setSize}
        onToggleErase={engine.toggleErase}
        onUndo={engine.undo}
        onRedo={engine.redo}
        onClear={engine.clear}
        onDone={handleDone}
        onCancel={onCancel}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  canvasArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
})
