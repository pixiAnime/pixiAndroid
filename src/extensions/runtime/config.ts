/**
 * Runtime tunables — defaults overridden via env (config/extensions).
 * Deadlines are enforced HOST-side: an unresponsive or hung sandbox can
 * never stall the site (spec §27/§28).
 */
import { config } from '@/config'

/** Whole-extension evaluation deadline per call. */
export const EXEC_TIMEOUT_MS = config.extensions.execTimeoutMs
/** Single extension HTTP request deadline. */
export const HTTP_TIMEOUT_MS = config.extensions.httpTimeoutMs
/** Subtitle providers get a tighter deadline (playback must start fast). */
export const SUBTITLE_TIMEOUT_MS = Math.min(8_000, config.extensions.execTimeoutMs)
/** Sandbox boot (evaluate module, read manifest) deadline. */
export const BOOT_TIMEOUT_MS = 10_000
