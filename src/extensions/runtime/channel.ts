/**
 * Handshake channel ids for the extension sandbox.
 *
 * `crypto.randomUUID` exists only in secure contexts, so a site opened over
 * plain http (LAN IP, tunnel) must still boot its sandbox — fall back to
 * CSPRNG bytes (available insecurely), then Math.random, instead of failing
 * the whole install with "The extension could not be loaded in this browser."
 *
 * Kept import-free so it runs under the Node test runner as-is.
 */
export function randomChannel(): string {
  const webCrypto: Crypto | undefined = globalThis.crypto
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}
