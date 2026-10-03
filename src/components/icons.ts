/**
 * The app's icon set — a deliberately small local barrel over lucide-react-native.
 *
 * The app draws 44 icons, but `lucide-react-native`'s own entry point is a
 * single barrel that re-exports **every** icon it ships (~1856 of them), and
 * Metro does not tree-shake ESM. Importing from the package root therefore put
 * all of them — and their SVG path data — into the release bundle, most of it
 * never rendered: 1862 distinct icons travelled with a build that showed 44.
 * This file names only what the app draws, so the rest never enters the graph.
 *
 * Each target comes straight from lucide's own barrel, so aliases still behave
 * exactly as they did before (`Home` is `house`, `History` is `rotate-ccw-clock`,
 * `Trash2` is `trash`, `AlertTriangle` is `triangle-alert` — names a naive
 * PascalCase→kebab-case guess gets wrong). Adding an icon means adding one line
 * here.
 *
 * Path resolution goes through lucide's published `./icons/*` subpath export,
 * which Metro honours (`unstable_enablePackageExports` is on by default).
 */

export { default as AlertTriangle } from 'lucide-react-native/icons/triangle-alert'
export { default as ArrowRight } from 'lucide-react-native/icons/arrow-right'
export { default as Calendar } from 'lucide-react-native/icons/calendar'
export { default as Captions } from 'lucide-react-native/icons/captions'
export { default as Check } from 'lucide-react-native/icons/check'
export { default as CheckCircle2 } from 'lucide-react-native/icons/circle-check'
export { default as ChevronLeft } from 'lucide-react-native/icons/chevron-left'
export { default as ChevronRight } from 'lucide-react-native/icons/chevron-right'
export { default as Clapperboard } from 'lucide-react-native/icons/clapperboard'
export { default as CloudOff } from 'lucide-react-native/icons/cloud-off'
export { default as Download } from 'lucide-react-native/icons/download'
export { default as FastForward } from 'lucide-react-native/icons/fast-forward'
export { default as Heart } from 'lucide-react-native/icons/heart'
export { default as History } from 'lucide-react-native/icons/rotate-ccw-clock'
export { default as Home } from 'lucide-react-native/icons/house'
export { default as ImageOff } from 'lucide-react-native/icons/image-off'
export { default as Info } from 'lucide-react-native/icons/info'
export { default as Layers } from 'lucide-react-native/icons/layers'
export { default as List } from 'lucide-react-native/icons/list'
export { default as ListVideo } from 'lucide-react-native/icons/list-video'
export { default as Loader2 } from 'lucide-react-native/icons/loader-circle'
export { default as Maximize } from 'lucide-react-native/icons/maximize'
export { default as Minimize } from 'lucide-react-native/icons/minimize'
export { default as PackageOpen } from 'lucide-react-native/icons/package-open'
export { default as Pause } from 'lucide-react-native/icons/pause'
export { default as PictureInPicture2 } from 'lucide-react-native/icons/picture-in-picture-2'
export { default as Play } from 'lucide-react-native/icons/play'
export { default as Puzzle } from 'lucide-react-native/icons/puzzle'
export { default as RefreshCw } from 'lucide-react-native/icons/refresh-cw'
export { default as Rewind } from 'lucide-react-native/icons/rewind'
export { default as RotateCcw } from 'lucide-react-native/icons/rotate-ccw'
export { default as Search } from 'lucide-react-native/icons/search'
export { default as SearchX } from 'lucide-react-native/icons/search-x'
export { default as Settings } from 'lucide-react-native/icons/settings'
export { default as ShieldAlert } from 'lucide-react-native/icons/shield-alert'
export { default as SkipBack } from 'lucide-react-native/icons/skip-back'
export { default as SkipForward } from 'lucide-react-native/icons/skip-forward'
export { default as SquareStack } from 'lucide-react-native/icons/square-stack'
export { default as Star } from 'lucide-react-native/icons/star'
export { default as Trash2 } from 'lucide-react-native/icons/trash'
export { default as Users } from 'lucide-react-native/icons/users'
export { default as Volume2 } from 'lucide-react-native/icons/volume-2'
export { default as VolumeX } from 'lucide-react-native/icons/volume-x'
export { default as X } from 'lucide-react-native/icons/x'
