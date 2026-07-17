import {useState} from 'react'
import {type LayoutChangeEvent, StyleSheet, View} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'

import {Toolbar} from '#/draw/components/Toolbar'
import {exportDrawing, type ExportResult} from '#/draw/engine/export'
import {DrawingCanvas} from '#/draw/engine/render'
import {DEFAULT_CANVAS_SIZE} from '#/draw/engine/types'
import {useDrawingEngine} from '#/draw/engine/useDrawingEngine'

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
  canvasSize = DEFAULT_CANVAS_SIZE,
}: {
  onDone: (result: ExportResult) => void
  onCancel: () => void
  onError?: (e: unknown) => void
  canvasSize?: number
}) {
  const engine = useDrawingEngine(canvasSize)
  const [viewSize, setViewSize] = useState(0)

  const onLayout = (e: LayoutChangeEvent) => {
    const {width, height} = e.nativeEvent.layout
    const size = Math.floor(Math.min(width, height))
    setViewSize(size)
    engine.setViewSize(size)
  }

  const handleDone = () => {
    try {
      onDone(exportDrawing(engine.strokes, engine.canvasSize))
    } catch (e) {
      onError?.(e)
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.canvasArea} onLayout={onLayout}>
        {viewSize > 0 && (
          <GestureDetector gesture={engine.gesture}>
            <View
              collapsable={false}
              style={{width: viewSize, height: viewSize}}>
              <DrawingCanvas
                strokes={engine.strokes}
                livePath={engine.livePath}
                liveBrush={engine.brush}
                canvasSize={engine.canvasSize}
                viewSize={viewSize}
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
