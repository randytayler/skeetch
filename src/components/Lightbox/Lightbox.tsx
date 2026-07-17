import {useCallback, useState} from 'react'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {shareImageModal} from '#/lib/media/manip'
import {useSaveImageToMediaLibrary} from '#/lib/media/save-image'
import ImageView from '#/components/Lightbox/pager/ImagePager'
import {
  type LightboxMetricsContext,
  useLightbox,
  useLightboxControls,
} from '#/components/Lightbox/state'
import {type ImageSource} from '#/components/Lightbox/types'
import {Portal} from '#/components/Portal'
import {
  DrawOnImageFlow,
  type DrawOnImageResult,
} from '#/draw/components/DrawOnImageFlow'

export function Lightbox() {
  const {activeLightbox} = useLightbox()
  const {closeLightbox} = useLightboxControls()
  const {openComposer} = useOpenComposer()

  const onClose = useCallback(() => {
    closeLightbox()
  }, [closeLightbox])

  const saveImageToAlbum = useSaveImageToMediaLibrary()

  // Draw-on-image (§8.2) needs its own post-close lifetime: the lightbox is
  // gone by the time the user is done drawing, and the composer it hands off
  // to hasn't opened yet.
  const [drawTarget, setDrawTarget] = useState<{
    image: ImageSource
    metrics: LightboxMetricsContext
  } | null>(null)

  const onPressDraw = useCallback(
    (image: ImageSource, metrics: LightboxMetricsContext) => {
      closeLightbox()
      setDrawTarget({image, metrics})
    },
    [closeLightbox],
  )

  const onDrawOnImageDone = useCallback(
    ({result, replyTo}: DrawOnImageResult) => {
      setDrawTarget(null)
      openComposer({
        replyTo,
        imageUris: [
          {uri: result.uri, width: result.width, height: result.height},
        ],
        logContext: 'PostReply',
      })
    },
    [openComposer],
  )

  return (
    <>
      <ImageView
        lightbox={activeLightbox}
        onRequestClose={onClose}
        onPressSave={uri => void saveImageToAlbum(uri)}
        onPressShare={uri => void shareImageModal({uri})}
        onPressDraw={onPressDraw}
      />
      {drawTarget && (
        <Portal>
          <DrawOnImageFlow
            imageUri={drawTarget.image.uri}
            postUri={drawTarget.metrics.postUri}
            onDone={onDrawOnImageDone}
            onCancel={() => setDrawTarget(null)}
          />
        </Portal>
      )}
    </>
  )
}
