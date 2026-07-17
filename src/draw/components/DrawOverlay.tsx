import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {DrawSurface} from '#/draw/components/DrawSurface'
import {type ExportResult} from '#/draw/engine/export'

/**
 * Full-screen drawing surface shown over the composer (DESIGN.md §8.1).
 *
 * Rendered through the app Portal so it sits above the composer, which is
 * itself an absolutely-positioned overlay rather than a navigator route — a
 * pushed screen would be covered by it, and closing the composer first would
 * discard the user's in-progress post. Keeping the composer mounted underneath
 * preserves its text, reply target, language, and labels.
 */
export function DrawOverlay({
  onDone,
  onCancel,
  onError,
}: {
  onDone: (result: ExportResult) => void
  onCancel: () => void
  onError?: (e: unknown) => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.root,
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}
      aria-modal
      accessibilityViewIsModal>
      <DrawSurface onDone={onDone} onCancel={onCancel} onError={onError} />
    </View>
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
