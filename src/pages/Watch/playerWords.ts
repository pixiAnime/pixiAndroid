/**
 * Player chrome words — the port of `pixiWeb/src/i18n/layout-words.ts`.
 *
 * The web passes these to Vidstack's `DefaultVideoLayout`, which uses them for
 * the control tooltips *and* their `aria-label`s; English comes from
 * Vidstack's own defaults, so `en` is not a translation of anything. They are
 * deliberately not in `resources/*.ts`: third-party UI words, not app copy
 * (same reasoning as the web file).
 *
 * `@/i18n/layout-words` lives outside this page's write scope, so the subset
 * the RN player actually renders is kept here — extended with the controls the
 * RN port draws itself (skip, mute, settings/speed, fit/fill, cue size,
 * autoplay, fullscreen), taking the same keys and translations the web file
 * uses. `display`, `fit`/`fill`, the three cue sizes, `autoNext` and `on` are
 * the words Vidstack has no entry for: they label things that only exist on
 * the phone — a fit/fill toggle for a tall screen, and a persisted cue size.
 */
import { i18n } from '@/i18n'

export type PlayerWord =
  | 'play'
  | 'pause'
  | 'replay'
  | 'seek'
  | 'seekBackward'
  | 'seekForward'
  | 'settings'
  | 'playback'
  | 'speed'
  | 'display'
  | 'fit'
  | 'fill'
  | 'size'
  | 'sizeSmall'
  | 'sizeMedium'
  | 'sizeLarge'
  | 'track'
  | 'skip'
  | 'holdSpeed'
  | 'sleepTimer'
  | 'audio'
  | 'pictureInPicture'
  | 'autoNext'
  | 'on'
  | 'mute'
  | 'unmute'
  | 'volume'
  | 'showControls'
  | 'hideControls'
  | 'fullscreen'
  | 'enterFullscreen'
  | 'exitFullscreen'
  // Redesign-only words (§12/§13). These label *states of the player itself*,
  // not Vidstack controls, so they are here for the same reason the rest are:
  // third-party/player chrome, not app copy, and outside the synced i18n scope.
  | 'loading'
  | 'playbackUnavailable'
  // Episode navigation that now lives *inside* the player (§2B): the top bar's
  // prev/next buttons and the heading of the episode sheet. They are chrome of
  // the player surface, not of the page underneath it, so they belong here
  // rather than in the synced `@/i18n` resources.
  | 'episodes'
  | 'prevEpisode'
  | 'nextEpisode'

const WORDS: Record<string, Record<PlayerWord, string>> = {
  en: {
    play: 'Play',
    pause: 'Pause',
    replay: 'Replay',
    seek: 'Seek',
    seekBackward: 'Seek Backward',
    seekForward: 'Seek Forward',
    settings: 'Settings',
    playback: 'Playback',
    speed: 'Speed',
    display: 'Display',
    fit: 'Fit',
    fill: 'Fill',
    size: 'Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    track: 'Track',
    skip: 'Skip',
    holdSpeed: 'Hold speed',
    sleepTimer: 'Sleep timer',
    audio: 'Audio',
    pictureInPicture: 'Picture in picture',
    autoNext: 'Auto next episode',
    on: 'On',
    mute: 'Mute',
    unmute: 'Unmute',
    volume: 'Volume',
    showControls: 'Show controls',
    hideControls: 'Hide controls',
    fullscreen: 'Fullscreen',
    enterFullscreen: 'Enter Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    loading: 'Loading…',
    playbackUnavailable: 'Playback unavailable',
    episodes: 'Episodes',
    prevEpisode: 'Previous episode',
    nextEpisode: 'Next episode',
  },
  tr: {
    play: 'Oynat',
    pause: 'Duraklat',
    replay: 'Tekrar Oynat',
    seek: 'Konum',
    seekBackward: 'Geri Sar',
    seekForward: 'İleri Sar',
    settings: 'Ayarlar',
    playback: 'Oynatma',
    speed: 'Hız',
    display: 'Görüntü',
    fit: 'Sığdır',
    fill: 'Doldur',
    size: 'Boyut',
    sizeSmall: 'Küçük',
    sizeMedium: 'Orta',
    sizeLarge: 'Büyük',
    track: 'Parça',
    skip: 'Atla',
    holdSpeed: 'Basılı tutma hızı',
    sleepTimer: 'Uyku zamanlayıcısı',
    audio: 'Ses',
    pictureInPicture: 'Pencere içi oynatma',
    autoNext: 'Sonraki bölümü otomatik oynat',
    on: 'Açık',
    mute: 'Sessize Al',
    unmute: 'Sesi Aç',
    volume: 'Ses Düzeyi',
    showControls: 'Kontrolleri göster',
    hideControls: 'Kontrolleri gizle',
    fullscreen: 'Tam Ekran',
    enterFullscreen: 'Tam Ekrana Geç',
    exitFullscreen: 'Tam Ekranı Kapat',
    loading: 'Yükleniyor…',
    playbackUnavailable: 'Oynatma kullanılamıyor',
    episodes: 'Bölümler',
    prevEpisode: 'Önceki bölüm',
    nextEpisode: 'Sonraki bölüm',
  },
  ru: {
    play: 'Воспроизвести',
    pause: 'Пауза',
    replay: 'Повторить',
    seek: 'Позиция',
    seekBackward: 'Перемотать назад',
    seekForward: 'Перемотать вперёд',
    settings: 'Настройки',
    playback: 'Воспроизведение',
    speed: 'Скорость',
    display: 'Изображение',
    fit: 'Вписать',
    fill: 'Заполнить',
    size: 'Размер',
    sizeSmall: 'Мелкий',
    sizeMedium: 'Средний',
    sizeLarge: 'Крупный',
    track: 'Дорожка',
    skip: 'Перемотка',
    holdSpeed: 'Скорость при удержании',
    sleepTimer: 'Таймер сна',
    audio: 'Звук',
    pictureInPicture: 'Картинка в картинке',
    autoNext: 'Автовоспроизведение следующей серии',
    on: 'Вкл.',
    mute: 'Выключить звук',
    unmute: 'Включить звук',
    volume: 'Громкость',
    showControls: 'Показать элементы управления',
    hideControls: 'Скрыть элементы управления',
    fullscreen: 'Полный экран',
    enterFullscreen: 'Во весь экран',
    exitFullscreen: 'Выйти из полноэкранного режима',
    loading: 'Загрузка…',
    playbackUnavailable: 'Воспроизведение недоступно',
    episodes: 'Серии',
    prevEpisode: 'Предыдущая серия',
    nextEpisode: 'Следующая серия',
  },
}

/** Current-language chrome word, falling back to Vidstack's English. */
export function playerWord(word: PlayerWord): string {
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]?.toLowerCase()
  return ((language ? WORDS[language] : undefined) ?? WORDS.en)[word]
}
