/**
 * Extension runtime errors — always structured, always friendly.
 * Raw stacks, bridge URLs and provider internals never reach the UI.
 */
import type { ExtensionErrorCode, StructuredExtensionError } from '../sdk/types.ts'

export class ExtensionError extends Error {
  readonly code: ExtensionErrorCode
  readonly extensionId?: string

  constructor(code: ExtensionErrorCode, message: string, extensionId?: string) {
    super(message)
    this.name = 'ExtensionError'
    this.code = code
    if (extensionId) this.extensionId = extensionId
  }
}

const CODE_SET = new Set<string>([
  'EXTENSION_ERROR',
  'EXTENSION_TIMEOUT',
  'EXTENSION_NOT_FOUND',
  'VALIDATION_FAILED',
  'API_VERSION_UNSUPPORTED',
  'INVALID_RESULT',
  'PIXICLIENT_UNAVAILABLE',
  'PIXICLIENT_ERROR',
  'HTTP_ERROR',
  'HTTP_TIMEOUT',
])

export function isExtensionErrorCode(value: unknown): value is ExtensionErrorCode {
  return typeof value === 'string' && CODE_SET.has(value)
}

/** Friendly fallback when an extension throws without a usable message. */
const GENERIC_MESSAGE = 'The extension failed while processing the request.'

/** Coerce anything thrown inside/for an extension into a structured error. */
export function toStructuredExtensionError(
  error: unknown,
  extensionId?: string,
): StructuredExtensionError {
  if (error instanceof ExtensionError) {
    return { extensionId: error.extensionId ?? extensionId, code: error.code, message: error.message }
  }
  if (error instanceof Error) {
    const message = typeof error.message === 'string' ? error.message.trim().slice(0, 300) : ''
    return {
      extensionId,
      code: 'EXTENSION_ERROR',
      message: message.length > 0 ? message : GENERIC_MESSAGE,
    }
  }
  return { extensionId, code: 'EXTENSION_ERROR', message: GENERIC_MESSAGE }
}
