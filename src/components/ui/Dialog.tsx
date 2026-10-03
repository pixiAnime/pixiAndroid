/**
 * `Dialog` — the port of the shadcn dialog used for every confirmation in
 * pixiWeb (removing an extension, clearing history, deleting a custom
 * subtitle, invalidating the episode cache).
 *
 * On the web it is a Radix modal: a centred card over a `bg-black/80`
 * backdrop with an `✕` in the corner and a footer action row. RN's `Modal`
 * gives the same behaviour, including `transparent` presentation so the
 * backdrop stays under our own paint.
 *
 * Semantics kept from the web: title via `accessibilityViewIsModal`, actions
 * right-aligned with an 8px gap, and destructive buttons use the
 * `destructive` variant rather than a tinted border.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional supporting copy — `text-sm text-muted-foreground`. */
  description?: string
  /** Footer buttons; rendered right-aligned, last one last. */
  children?: React.ReactNode
}

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>

          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}

          {children ? <View style={styles.footer}>{children}</View> : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.none,
    padding: spacing.xl,
    gap: spacing.md,
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, padding: spacing.xs, zIndex: 2 },
  closeGlyph: { color: colors.mutedForeground, fontSize: 14, fontFamily: fonts.regular },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.foreground, paddingRight: 24 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
})
