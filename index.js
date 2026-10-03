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
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
