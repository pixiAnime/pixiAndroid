/**
 * ErrorState — §13 of the redesign brief, kept *inside* the player.
 *
 * ```
 * Playback unavailable
 * We couldn't load this video.
 * [ Retry ]
 * ```
 *
 * The failure never navigates away: the surface, the resolved source list and
 * the episode context all stay exactly where they were, so a retry is one tap
 * and giving up is the back button. That is also why the copy is a fixed
 * two-line skeleton — a title that names the situation, and underneath it the
 * *localised* reason the extension actually gave (`localizeExtensionMessage`),
 * which is far more useful than a generic sentence and still reads as one
 * sentence because the title carries the state.
 *
 * §13's `[ Try another server ]` is deliberately absent here: offering
 * alternatives requires the page's source list, which this component does not
 * own and should not. It arrives with the server/quality work, wired from the
 * page down through `Player`.
 *
 * The frame is a full-surface scrim rather than a dialog, so the video behind
 * it (and any frame ExoPlayer already decoded) stays visible — an error should
 * look like the player failed, not like the app crashed.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from '@/components/icons'

import { colors, fonts, radii, spacing } from '@/theme'

import { playerWord } from '../../playerWords'

export interface ErrorStateProps {
  /** Localised, one-sentence explanation of what went wrong. */
  message: string
  /** Whether a re-resolution is already running. */
  retrying?: boolean
  onRetry: () => void
}

export function ErrorState({ message, retrying = false, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()

  return (
    <View accessibilityRole="alert" style={styles.frame}>
      <View style={styles.icon}>
        <AlertTriangle size={20} color={colors.mutedForeground} strokeWidth={1.6} />
      </View>

      <Text style={styles.title}>{playerWord('playbackUnavailable')}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={retrying}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}>
        {retrying ? (
          <ActivityIndicator color={colors.background} size="small" />
        ) : (
          <>
            <RefreshCw size={13} color={colors.background} strokeWidth={1.8} />
            <Text style={styles.retryLabel}>{t('common.tryAgain')}</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  /** Full-surface, but translucent: the picture behind it is part of the story. */
  frame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(10,10,10,0.86)',
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    marginBottom: spacing.xs,
  },
  /** Monospace, uppercase, tracked — the same register as the player's badges. */
  title: {
    fontFamily: fonts.mono,
    fontSize: 11.2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.foreground,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 320,
  },
  /** Inverted primary (§17): on this surface white *is* the accent. */
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  retryPressed: { opacity: 0.82 },
  retryLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.background,
  },
})
