/**
 * Installs the WHATWG `URL` / `URLSearchParams` globals that React Native
 * does not ship.
 *
 * Shared modules build request URLs with `new URL(...)` everywhere — the API
 * clients, the HTTP policy layer, `context.utils.withQuery` inside the
 * sandbox — so this has to exist before any of them runs. The QuickJS sandbox
 * gets its own copy of the very same implementation, injected as the first
 * stage of its bootstrap (see `platform/quickjs/generated/urlPolyfill.ts`),
 * which is why host and sandbox can never disagree about URL semantics.
 *
 * Import this module for its side effect from `index.js`.
 */
import { setupURLPolyfill } from 'react-native-url-polyfill'

setupURLPolyfill()

export { URL, URLSearchParams } from 'react-native-url-polyfill'
