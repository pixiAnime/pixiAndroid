/**
 * App entry.
 *
 * The first two imports are side-effect installs and their order matters:
 * shared modules call `new URL(...)` and persisted stores read
 * `localStorage` at module-evaluation time, so both globals must exist
 * before anything else in the graph is evaluated.
 */
import './src/platform/urlPolyfill';
import './src/platform/storage/localStorage';

import { AppRegistry } from 'react-native';
import { enableFreeze } from 'react-native-screens';

import App from './App';
import { name as appName } from './app.json';

// react-native-screens ships with freezing OFF (ENABLE_FREEZE = false), so
// every blurred screen keeps re-rendering on each react-query event, history
// update and i18n change — e.g. Home re-rendering all seven of its rows while
// the player is open. Freezing suspends a screen's JS tree while it is not
// focused; state updates queue and apply on return, which is exactly what
// `freezeOnBlur` (defaulting to this flag) is for.
enableFreeze(true);

AppRegistry.registerComponent(appName, () => App);
