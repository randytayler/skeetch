import {
  type Brush,
  type Point,
  type SourcePost,
  type Stroke,
} from '#/draw/engine/types'
import {
  type DrawingSession,
  drawingToSession,
  sessionToDrawing,
} from '../serialize'

const pt = (x: number, y: number): Point => ({x, y, p: 1, t: 0})
const brush: Brush = {color: '#123456', size: 12, opacity: 1, mode: 'draw'}
const stroke = (id: string): Stroke => ({
  id,
  brush,
  points: [pt(0, 0), pt(5, 5)],
  seed: 7,
})
const meta = {id: 'draft-1', createdAt: 100, updatedAt: 200}

describe('draft serialization (§5, §7)', () => {
  it('round-trips a blank-canvas session', () => {
    const session: DrawingSession = {
      strokes: [stroke('a'), stroke('b')],
      canvas: {width: 2048, height: 2048},
    }
    const back = drawingToSession(sessionToDrawing(session, meta))
    expect(back.strokes).toEqual(session.strokes)
    expect(back.canvas).toEqual(session.canvas)
    expect(back.sourcePost).toBeUndefined()
    expect(back.sourceImageUri).toBeUndefined()
  })

  it('round-trips a draw-on-image session with provenance', () => {
    const sourcePost: SourcePost = {
      uri: 'at://did:plc:x/app.bsky.feed.post/1',
      cid: 'bafycid',
      authorHandle: 'alice.test',
    }
    const session: DrawingSession = {
      strokes: [stroke('a')],
      canvas: {width: 1600, height: 900},
      sourcePost,
      sourceImageUri: 'file:///drafts/draft-1.src.jpg',
    }
    const back = drawingToSession(sessionToDrawing(session, meta))
    expect(back).toEqual(session)
  })

  it('models a source photo as locked layer 0 beneath the ink (§6.5)', () => {
    const drawing = sessionToDrawing(
      {
        strokes: [stroke('a')],
        canvas: {width: 100, height: 100},
        sourceImageUri: 'file:///drafts/draft-1.src.png',
      },
      meta,
    )
    expect(drawing.layers.map(layer => layer.kind)).toEqual(['image', 'ink'])
    const [image, ink] = drawing.layers
    expect(image.locked).toBe(true)
    expect(image.imageUri).toBe('file:///drafts/draft-1.src.png')
    expect(image.strokes).toEqual([])
    expect(ink.locked).toBe(false)
    expect(ink.strokes.map(s => s.id)).toEqual(['a'])
  })

  it('carries drawing metadata and dimensions onto the persisted Drawing', () => {
    const drawing = sessionToDrawing(
      {strokes: [], canvas: {width: 640, height: 480}},
      meta,
    )
    expect(drawing.id).toBe('draft-1')
    expect(drawing.createdAt).toBe(100)
    expect(drawing.updatedAt).toBe(200)
    expect(drawing.width).toBe(640)
    expect(drawing.height).toBe(480)
    expect(drawing.layers.map(l => l.kind)).toEqual(['ink'])
  })
})
