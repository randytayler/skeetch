import {useEffect, useState} from 'react'
import {FlatList, Pressable, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {deleteDraft, listDrafts} from '#/draw/storage/drafts'
import {type DraftIndexEntry} from '#/draw/storage/index'

/**
 * Draft gallery (DESIGN.md §7): the browsable list of saved drawings the user
 * lands on when tapping Draw. Selecting a card resumes that draft; New starts a
 * blank canvas. Deliberately plain - visual polish is M10, not M6.
 *
 * Fetches its own list on mount, so it refreshes naturally each time the flow
 * returns here from the canvas (a just-created draft appears without plumbing).
 */
export function DraftGallery({
  onNew,
  onSelect,
  onClose,
}: {
  onNew: () => void
  onSelect: (entry: DraftIndexEntry) => void
  onClose: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const insets = useSafeAreaInsets()
  const [entries, setEntries] = useState<DraftIndexEntry[] | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DraftIndexEntry | null>(
    null,
  )
  const deleteControl = Prompt.usePromptControl()

  useEffect(() => {
    let cancelled = false
    void listDrafts().then(list => {
      if (!cancelled) setEntries(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onConfirmDelete = () => {
    const target = pendingDelete
    if (!target) return
    setEntries(prev => prev?.filter(e => e.id !== target.id) ?? null)
    void deleteDraft(target.id)
  }

  return (
    <View
      style={[
        styles.root,
        t.atoms.bg,
        {paddingTop: insets.top, paddingBottom: insets.bottom},
      ]}
      aria-modal
      accessibilityViewIsModal>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.px_lg,
          a.py_md,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <Button
          label={l`Close drawing`}
          onPress={onClose}
          size="small"
          color="secondary"
          shape="round"
          variant="ghost">
          <ButtonIcon icon={XIcon} />
        </Button>
        <Text style={[a.text_lg, a.font_bold]}>{l`Drawings`}</Text>
        <Button
          testID="newDrawingButton"
          label={l`New drawing`}
          onPress={onNew}
          size="small"
          color="primary"
          variant="solid">
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>{l`New`}</ButtonText>
        </Button>
      </View>

      {entries === null ? (
        <View style={[a.flex_1, a.align_center, a.justify_center]}>
          <Loader size="xl" />
        </View>
      ) : entries.length === 0 ? (
        <View style={[a.flex_1, a.align_center, a.justify_center, a.px_2xl]}>
          <Text
            style={[
              a.text_center,
              t.atoms.text_contrast_medium,
              a.leading_snug,
            ]}>
            {l`No saved drawings yet. Tap New to start one.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={[a.p_md, a.gap_md]}
          columnWrapperStyle={a.gap_md}
          renderItem={({item}) => (
            <DraftCard
              entry={item}
              label={
                item.updatedAt
                  ? i18n.date(item.updatedAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : ''
              }
              onPress={() => onSelect(item)}
              onDelete={() => {
                setPendingDelete(item)
                deleteControl.open()
              }}
            />
          )}
        />
      )}

      <Prompt.Basic
        control={deleteControl}
        title={l`Delete this drawing?`}
        description={l`This drawing and its saved copy will be permanently removed.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={onConfirmDelete}
      />
    </View>
  )
}

function DraftCard({
  entry,
  label,
  onPress,
  onDelete,
}: {
  entry: DraftIndexEntry
  label: string
  onPress: () => void
  onDelete: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const aspectRatio =
    entry.width > 0 && entry.height > 0 ? entry.width / entry.height : 1

  return (
    <View style={a.flex_1}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={l`Open drawing from ${label}`}
        accessibilityHint=""
        onPress={onPress}
        style={[
          a.w_full,
          a.rounded_md,
          a.overflow_hidden,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        {entry.thumbnailUri ? (
          <Image
            source={{uri: entry.thumbnailUri}}
            style={[a.w_full, {aspectRatio}]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              a.w_full,
              a.align_center,
              a.justify_center,
              t.atoms.bg_contrast_25,
              {aspectRatio},
            ]}>
            <Text style={t.atoms.text_contrast_low}>{l`No preview`}</Text>
          </View>
        )}
      </Pressable>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.pt_xs]}>
        <Text
          style={[a.text_xs, t.atoms.text_contrast_medium, a.flex_1]}
          numberOfLines={1}>
          {label}
        </Text>
        <Button
          label={l`Delete drawing`}
          onPress={onDelete}
          size="tiny"
          color="secondary"
          shape="round"
          variant="ghost">
          <ButtonIcon icon={TrashIcon} />
        </Button>
      </View>
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
  },
})
