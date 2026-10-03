/**
 * defineExtension — identity helper that gives authors type-checking and
 * autocompletion. It is bundled into the extension build (no runtime SDK
 * import happens inside the sandbox; the site injects `context` per call).
 */
import type { AnimeExtension } from './types.ts'

export function defineExtension<const T extends AnimeExtension>(extension: T): T {
  return extension
}
