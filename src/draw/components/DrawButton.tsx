import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {PencilLine_Stroke2_Corner0_Rounded as PencilLine} from '#/components/icons/Pencil'
import {IS_NATIVE} from '#/env'

/**
 * Composer entry point for the drawing surface (DESIGN.md §8.1). Opens the
 * canvas; the flattened PNG comes back as a normal image attachment.
 */
export function DrawButton({
  disabled,
  onPress,
}: {
  disabled?: boolean
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()

  // Drawing is a touch surface; Android is the only supported target (§2).
  if (!IS_NATIVE) {
    return null
  }

  return (
    <Button
      testID="openDrawButton"
      onPress={onPress}
      label={l`Draw`}
      accessibilityHint={l`Opens a canvas to draw an image for this post`}
      style={a.p_sm}
      variant="ghost"
      shape="round"
      color="primary"
      disabled={disabled}>
      <PencilLine size="lg" style={disabled && t.atoms.text_contrast_low} />
    </Button>
  )
}
