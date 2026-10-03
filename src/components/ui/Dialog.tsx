/**
 * `Dialog` — Material 3 basic dialog.
 *
 * A 28px-radius surface floating on a scrim, with a title, optional supporting
 * copy, and a right-aligned action row. RN's `Modal` supplies the behaviour
 * (including `transparent` presentation so our own scrim stays visible).
 *
 * Semantics kept from the web: title via `accessibilityViewIsModal`, actions
 * right-aligned, and destructive actions use the `destructive` button variant.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'lucide-react-native'

import { colors, fonts, radii, spacing } from '@/theme'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional supporting copy. */
  description?: string
  /** Footer actions; rendered right-aligned, last one last. */
  children?: React.ReactNode
}

export function Dialog({ open, onClose, title, description, children }: DialogProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <Pressable
            style={styles.close}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <X size={20} color={colors.onSurfaceVariant} strokeWidth={2} />
          </Pressable>

          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
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
    backgroundColor: colors.scrim,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, padding: spacing.xs, zIndex: 2 },
  title: { fontFamily: fonts.medium, fontSize: 22, lineHeight: 28, color: colors.onSurface, paddingRight: 28 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.onSurfaceVariant },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
})
