/**
 * User-facing error taxonomy — the mobile port of `pixiWeb/src/lib/errors.ts`.
 *
 * Every failure the UI can show funnels through `toAppError` so pages render
 * friendly, non-technical messages — never raw stack traces or status codes.
 * Copy comes from i18n (`errors.*`), resolved against the active language.
 *
 * The web build additionally recognises `BridgeOfflineError` / `BridgeError`
 * from its pixiClient bridge. Android has no bridge (native HTTP and a native
 * QuickJS module replace it entirely), so those two branches are unreachable
 * here — the `bridge-offline` / `bridge-error` kinds are kept in the union so
 * shared components and copy stay byte-compatible with the web.
 */
import { ApiError } from '@/api/errors'
import { i18n } from '@/i18n'

export type AppErrorKind =
  | 'jikan-unavailable' // network failure / 5xx from Jikan
  | 'rate-limited' // 429
  | 'not-found' // 404 / invalid anime id
  | 'bad-request' // 400
  | 'bridge-offline' // unreachable on mobile — see file comment
  | 'bridge-error' // unreachable on mobile — see file comment
  | 'empty' // no results
  | 'unexpected'

export interface AppErrorInfo {
  kind: AppErrorKind
  title: string
  description: string
  /** Whether offering a "Try again" button makes sense. */
  retryable: boolean
}

export function toAppError(error: unknown): AppErrorInfo {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'rate-limited':
        return {
          kind: 'rate-limited',
          title: i18n.t('errors.rateLimited.title'),
          description: i18n.t('errors.rateLimited.description'),
          retryable: true,
        }
      case 'not-found':
        return {
          kind: 'not-found',
          title: i18n.t('errors.notFound.title'),
          description: i18n.t('errors.notFound.description'),
          retryable: false,
        }
      case 'bad-request':
        return {
          kind: 'bad-request',
          title: i18n.t('errors.badRequest.title'),
          description: i18n.t('errors.badRequest.description'),
          retryable: false,
        }
      case 'server':
        return {
          kind: 'jikan-unavailable',
          title: i18n.t('errors.jikanUnavailable.title'),
          description: i18n.t('errors.jikanUnavailable.description'),
          retryable: true,
        }
      case 'network':
        return {
          kind: 'jikan-unavailable',
          title: i18n.t('errors.network.title'),
          description: i18n.t('errors.network.description'),
          retryable: true,
        }
      default:
        return {
          kind: 'unexpected',
          title: i18n.t('errors.unexpected.title'),
          description: i18n.t('errors.unexpected.description'),
          retryable: true,
        }
    }
  }

  return {
    kind: 'unexpected',
    title: i18n.t('errors.unexpected.title'),
    description: i18n.t('errors.unexpected.descriptionAlt'),
    retryable: true,
  }
}
