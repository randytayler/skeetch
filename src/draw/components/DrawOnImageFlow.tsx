import {useEffect, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {AppBskyFeedPost} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'
import {nanoid} from 'nanoid/non-secure'

import {usePostQuery} from '#/state/queries/post'
import {type ComposerOptsPostRef} from '#/state/shell/composer'
import {atoms as a} from '#/alf'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {DrawOverlay} from '#/draw/components/DrawOverlay'
import {type ExportResult} from '#/draw/engine/export'
import {fetchSourceImage, type SourceImage} from '#/draw/engine/sourceImage'
import {type SourcePost} from '#/draw/engine/types'
import * as bsky from '#/types/bsky'

export type DrawOnImageResult = {
  result: ExportResult
  replyTo: ComposerOptsPostRef
  sourcePost: SourcePost
}

/**
 * Draw-on-image flow (DESIGN.md §8.2): fetch the source post's full-resolution
 * image and the post itself (the composer's reply needs the full post ref,
 * which the lightbox only carries a URI for), then hand off to the same
 * drawing surface the blank-canvas path uses, over a locked photo layer.
 *
 * The image fetch and the post lookup are both real network work, so this
 * shows a brief loading state rather than opening onto a half-ready canvas.
 */
export function DrawOnImageFlow({
  imageUri,
  postUri,
  onDone,
  onCancel,
}: {
  imageUri: string
  postUri: string
  onDone: (result: DrawOnImageResult) => void
  onCancel: () => void
}) {
  const {t: l} = useLingui()
  const postQuery = usePostQuery(postUri)
  const [source, setSource] = useState<SourceImage | 'error' | null>(null)
  // Stable draft identity for this session so autosaves accumulate into one
  // draft (§7) rather than a new one per save.
  // eslint-disable-next-line react/hook-use-state
  const [draftMeta] = useState(() => ({id: nanoid(), createdAt: Date.now()}))

  useEffect(() => {
    let cancelled = false
    fetchSourceImage(imageUri)
      .then(loaded => {
        if (!cancelled) setSource(loaded)
      })
      .catch(() => {
        if (!cancelled) setSource('error')
      })
    return () => {
      cancelled = true
    }
  }, [imageUri])

  const failed = source === 'error' || postQuery.isError
  useEffect(() => {
    if (failed) {
      Toast.show(l`Could not load that image to draw on.`, {type: 'warning'})
      onCancel()
    }
  }, [failed, onCancel, l])

  const post = postQuery.data
  if (failed || !source || !post) {
    return (
      <View style={[styles.root, a.align_center, a.justify_center]}>
        <Loader size="3xl" />
      </View>
    )
  }

  const record = bsky.dangerousIsType<AppBskyFeedPost.Record>(
    post.record,
    AppBskyFeedPost.isRecord,
  )
    ? post.record
    : undefined

  const sourcePost: SourcePost = {
    uri: post.uri,
    cid: post.cid,
    authorHandle: post.author.handle,
  }

  return (
    <DrawOverlay
      canvas={source.canvas}
      backgroundImage={source.image}
      persistence={{
        draftId: draftMeta.id,
        createdAt: draftMeta.createdAt,
        sourcePost,
        sourceImageUri: source.localUri,
      }}
      onCancel={onCancel}
      onDone={result =>
        onDone({
          result,
          replyTo: {
            uri: post.uri,
            cid: post.cid,
            text: record?.text ?? '',
            author: post.author,
            embed: post.embed,
            langs: record?.langs,
          },
          sourcePost,
        })
      }
    />
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff',
  },
})
