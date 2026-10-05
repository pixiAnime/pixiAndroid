/**
 * Mobile-owned i18n overlay.
 *
 * `src/i18n/resources/*` are synced byte-for-byte from pixiWeb (see
 * `shared-manifest.json`), so Android-only strings cannot live there. This
 * module carries just those extra keys; `src/i18n/index.ts` deep-merges the
 * relevant language into the shared resource at init time.
 *
 * Keys are addressed through `mobileKeys` constants rather than through the
 * translation helper with an inline literal, because the synced
 * `tests/i18n.test.ts` asserts that every such literal resolves against the
 * shared `en` bundle. The overlay merges each namespace's *direct children*,
 * so `settings.*` and `extensions.*` additions land beside the shared keys.
 */

export const mobileKeys = {
  /* Status banner (existing). */
  running: 'status.running',
  stopped: 'status.stopped',
  connecting: 'status.connecting',
  error: 'status.error',
  aria: 'status.aria',

  /* Extensions — repositories. */
  repoAdd: 'extensions.repoAdd',
  repoFormTitle: 'extensions.repoFormTitle',
  repoUrlLabel: 'extensions.repoUrlLabel',
  repoUrlPlaceholder: 'extensions.repoUrlPlaceholder',
  repoFormNote: 'extensions.repoFormNote',
  repoConfirm: 'extensions.repoConfirm',
  repoSection: 'extensions.repoSection',
  repoEmptyTitle: 'extensions.repoEmptyTitle',
  repoEmptyDesc: 'extensions.repoEmptyDesc',
  repoDesc: 'extensions.repoDesc',
  repoProviders: 'extensions.repoProviders',
  repoCount: 'extensions.repoCount',
  repoAdded: 'extensions.repoAdded',
  repoRemoved: 'extensions.repoRemoved',
  repoRemoveTitle: 'extensions.repoRemoveTitle',
  repoRemoveDesc: 'extensions.repoRemoveDesc',
  repoRefresh: 'extensions.repoRefresh',
  repoBack: 'extensions.repoBack',
  repoRefreshAria: 'extensions.repoRefreshAria',
  repoOpenAria: 'extensions.repoOpenAria',
  providerInstall: 'extensions.providerInstall',
  providerInstalled: 'extensions.providerInstalled',
  providerInstalling: 'extensions.providerInstalling',
  providerInstallAll: 'extensions.providerInstallAll',
  providerInstallAria: 'extensions.providerInstallAria',

  /* Settings — expanded hub. */
  playbackHeading: 'settings.playbackHeading',
  playbackAria: 'settings.playbackAria',
  autoplayNext: 'settings.autoplayNext',
  autoplayNextDesc: 'settings.autoplayNextDesc',
  skipInterval: 'settings.skipInterval',
  skipIntervalDesc: 'settings.skipIntervalDesc',
  holdSpeed: 'settings.holdSpeed',
  holdSpeedDesc: 'settings.holdSpeedDesc',
  subtitleSize: 'settings.subtitleSize',
  subtitleSizeDesc: 'settings.subtitleSizeDesc',
  subtitleLanguage: 'settings.subtitleLanguage',
  subtitleLanguageDesc: 'settings.subtitleLanguageDesc',
  subtitleAuto: 'settings.subtitleAuto',
  defaultVolume: 'settings.defaultVolume',
  defaultVolumeDesc: 'settings.defaultVolumeDesc',
  fillToggle: 'settings.fillToggle',
  fillToggleDesc: 'settings.fillToggleDesc',

  contentHeading: 'settings.contentHeading',
  contentAria: 'settings.contentAria',
  titleLanguage: 'settings.titleLanguage',
  titleLanguageDesc: 'settings.titleLanguageDesc',
  titleEn: 'settings.titleEn',
  titleRomaji: 'settings.titleRomaji',
  titleNative: 'settings.titleNative',
  hideAdult: 'settings.hideAdult',
  hideAdultDesc: 'settings.hideAdultDesc',

  storageHeading: 'settings.storageHeading',
  storageAria: 'settings.storageAria',
  clearCache: 'settings.clearCache',
  clearCacheDesc: 'settings.clearCacheDesc',
  clearExtensionsData: 'settings.clearExtensionsData',
  clearExtensionsDataDesc: 'settings.clearExtensionsDataDesc',
  cacheCleared: 'settings.cacheCleared',
  extensionsCleared: 'settings.extensionsCleared',

  dataHeading: 'settings.dataHeading',
  dataAria: 'settings.dataAria',
  clearHistory: 'settings.clearHistory',
  clearHistoryDesc: 'settings.clearHistoryDesc',
  clearMyList: 'settings.clearMyList',
  clearMyListDesc: 'settings.clearMyListDesc',
  clearRecent: 'settings.clearRecent',
  clearRecentDesc: 'settings.clearRecentDesc',
  resetSettings: 'settings.resetSettings',
  resetSettingsDesc: 'settings.resetSettingsDesc',
  confirmTitle: 'settings.confirmTitle',
  confirmClearHistory: 'settings.confirmClearHistory',
  confirmClearMyList: 'settings.confirmClearMyList',
  confirmClearRecent: 'settings.confirmClearRecent',
  confirmClearCache: 'settings.confirmClearCache',
  confirmClearExtensions: 'settings.confirmClearExtensions',
  confirmReset: 'settings.confirmReset',
  historyCleared: 'settings.historyCleared',
  myListCleared: 'settings.myListCleared',
  recentCleared: 'settings.recentCleared',
  settingsReset: 'settings.settingsReset',

  extensionsHeading: 'settings.extensionsHeading',
  extensionsAria: 'settings.extensionsAria',
  autoCheckUpdates: 'settings.autoCheckUpdates',
  autoCheckUpdatesDesc: 'settings.autoCheckUpdatesDesc',
  manageRepos: 'settings.manageRepos',
} as const

type StatusOverlay = {
  running: string
  stopped: string
  connecting: string
  error: string
  aria: string
}

type ExtensionsOverlay = {
  repoAdd: string
  repoFormTitle: string
  repoUrlLabel: string
  repoUrlPlaceholder: string
  repoFormNote: string
  repoConfirm: string
  repoSection: string
  repoEmptyTitle: string
  repoEmptyDesc: string
  repoDesc: string
  repoProviders_one: string
  repoProviders_other: string
  repoCount_one: string
  repoCount_other: string
  repoAdded: string
  repoRemoved: string
  repoRemoveTitle: string
  repoRemoveDesc: string
  repoRefresh: string
  repoBack: string
  repoRefreshAria: string
  repoOpenAria: string
  providerInstall: string
  providerInstalled: string
  providerInstalling: string
  providerInstallAll: string
  providerInstallAria: string
}

type SettingsOverlay = {
  playbackHeading: string
  playbackAria: string
  autoplayNext: string
  autoplayNextDesc: string
  skipInterval: string
  skipIntervalDesc: string
  holdSpeed: string
  holdSpeedDesc: string
  subtitleSize: string
  subtitleSizeDesc: string
  subtitleLanguage: string
  subtitleLanguageDesc: string
  subtitleAuto: string
  defaultVolume: string
  defaultVolumeDesc: string
  fillToggle: string
  fillToggleDesc: string

  contentHeading: string
  contentAria: string
  titleLanguage: string
  titleLanguageDesc: string
  titleEn: string
  titleRomaji: string
  titleNative: string
  hideAdult: string
  hideAdultDesc: string

  storageHeading: string
  storageAria: string
  clearCache: string
  clearCacheDesc: string
  clearExtensionsData: string
  clearExtensionsDataDesc: string
  cacheCleared: string
  extensionsCleared: string

  dataHeading: string
  dataAria: string
  clearHistory: string
  clearHistoryDesc: string
  clearMyList: string
  clearMyListDesc: string
  clearRecent: string
  clearRecentDesc: string
  resetSettings: string
  resetSettingsDesc: string
  confirmTitle: string
  confirmClearHistory: string
  confirmClearMyList: string
  confirmClearRecent: string
  confirmClearCache: string
  confirmClearExtensions: string
  confirmReset: string
  historyCleared: string
  myListCleared: string
  recentCleared: string
  settingsReset: string

  extensionsHeading: string
  extensionsAria: string
  autoCheckUpdates: string
  autoCheckUpdatesDesc: string
  manageRepos: string
}

type Overlay = {
  status: StatusOverlay
  extensions: ExtensionsOverlay
  settings: SettingsOverlay
}

const en: Overlay = {
  status: {
    running: 'Running',
    stopped: 'Stopped',
    connecting: 'Connecting',
    error: 'Error',
    aria: 'Connection status: {{status}}',
  },
  extensions: {
    repoAdd: 'Add Repository',
    repoFormTitle: 'Add repository from URL',
    repoUrlLabel: 'Repository manifest URL',
    repoUrlPlaceholder: 'https://example.com/repo/manifest.json',
    repoFormNote:
      'The manifest is downloaded and validated. Providers it lists are installed one by one.',
    repoConfirm: 'Add repository',
    repoSection: 'Repositories',
    repoEmptyTitle: 'No repositories',
    repoEmptyDesc:
      'Add a repository manifest URL to browse and install the providers it lists.',
    repoDesc:
      'Repositories bundle several providers behind one manifest URL — add one and install the providers you want.',
    repoProviders_one: '{{count}} provider',
    repoProviders_other: '{{count}} providers',
    repoCount_one: '{{count}} repository',
    repoCount_other: '{{count}} repositories',
    repoAdded: 'Added repository {{name}}.',
    repoRemoved: 'Removed repository {{name}}.',
    repoRemoveTitle: 'Remove repository?',
    repoRemoveDesc:
      '{{name}} will be removed. Providers you already installed stay installed.',
    repoRefresh: 'Refresh',
    repoBack: 'Repositories',
    repoRefreshAria: 'Refresh repository {{name}}',
    repoOpenAria: 'Open repository {{name}}',
    providerInstall: 'Install',
    providerInstalled: 'Installed',
    providerInstalling: 'Installing…',
    providerInstallAll: 'Install all',
    providerInstallAria: 'Install provider {{name}}',
  },
  settings: {
    playbackHeading: 'Playback',
    playbackAria: 'Playback settings',
    autoplayNext: 'Autoplay next episode',
    autoplayNextDesc: 'Start the next episode automatically when one ends.',
    skipInterval: 'Skip interval',
    skipIntervalDesc: 'How far the double-tap and the skip buttons jump.',
    holdSpeed: 'Hold speed',
    holdSpeedDesc: 'Playback speed while you press and hold the picture.',
    subtitleSize: 'Subtitle size',
    subtitleSizeDesc: 'Default caption size in the player.',
    subtitleLanguage: 'Subtitle language',
    subtitleLanguageDesc: 'Which captions auto-select when an episode opens.',
    subtitleAuto: 'App language',
    defaultVolume: 'Default volume',
    defaultVolumeDesc: 'Output level the player opens at.',
    fillToggle: 'Fill the screen',
    fillToggleDesc: 'Open the player zoomed to fill the screen instead of fitting the frame.',

    contentHeading: 'Content',
    contentAria: 'Content settings',
    titleLanguage: 'Title language',
    titleLanguageDesc: 'Which title is shown for an anime.',
    titleEn: 'English',
    titleRomaji: 'Romaji',
    titleNative: 'Japanese',
    hideAdult: 'Hide adult content',
    hideAdultDesc: 'Hide hentai and adult-rated titles from lists.',

    storageHeading: 'Storage',
    storageAria: 'Storage',
    clearCache: 'Clear cached data',
    clearCacheDesc: 'Remove cached anime metadata and posters. Nothing else is affected.',
    clearExtensionsData: 'Remove all extensions',
    clearExtensionsDataDesc: 'Uninstall every extension and repository.',
    cacheCleared: 'Cached data cleared.',
    extensionsCleared: 'All extensions removed.',

    dataHeading: 'Data & privacy',
    dataAria: 'Data and privacy',
    clearHistory: 'Clear watch history',
    clearHistoryDesc: 'Remove every episode you watched and its progress.',
    clearMyList: 'Clear My List',
    clearMyListDesc: 'Remove every anime saved to your list.',
    clearRecent: 'Clear recently viewed',
    clearRecentDesc: 'Remove the recently viewed history.',
    resetSettings: 'Reset settings',
    resetSettingsDesc: 'Restore every app setting to its default. History and list stay.',
    confirmTitle: 'Are you sure?',
    confirmClearHistory: 'This removes all watch history from this device.',
    confirmClearMyList: 'This removes every title from My List.',
    confirmClearRecent: 'This removes your recently viewed list.',
    confirmClearCache: 'This removes cached metadata; it reloads from the network.',
    confirmClearExtensions: 'This uninstalls every extension and repository.',
    confirmReset: 'This restores all settings to their defaults.',
    historyCleared: 'Watch history cleared.',
    myListCleared: 'My List cleared.',
    recentCleared: 'Recently viewed cleared.',
    settingsReset: 'Settings reset.',

    extensionsHeading: 'Extensions',
    extensionsAria: 'Extension settings',
    autoCheckUpdates: 'Check for extension updates on open',
    autoCheckUpdatesDesc: 'Refresh repository manifests when the Extensions page opens.',
    manageRepos: 'Manage repositories & providers',
  },
}

const tr: Overlay = {
  status: {
    running: 'Çalışıyor',
    stopped: 'Durduruldu',
    connecting: 'Bağlanıyor',
    error: 'Hata',
    aria: 'Bağlantı durumu: {{status}}',
  },
  extensions: {
    repoAdd: 'Depo Ekle',
    repoFormTitle: 'URL ile depo ekle',
    repoUrlLabel: 'Depo manifest adresi',
    repoUrlPlaceholder: 'https://ornek.com/depo/manifest.json',
    repoFormNote:
      'Manifest indirilip doğrulanır. Listelediği sağlayıcılar tek tek kurulur.',
    repoConfirm: 'Depoyu ekle',
    repoSection: 'Depolar',
    repoEmptyTitle: 'Depo yok',
    repoEmptyDesc:
      'Bir depo manifest adresi ekleyerek listelediği sağlayıcılara göz atıp kurun.',
    repoDesc:
      'Depolar, birçok sağlayıcıyı tek bir manifest adresi arkasında toplar — bir tane ekleyin ve istediğiniz sağlayıcıları kurun.',
    repoProviders_one: '{{count}} sağlayıcı',
    repoProviders_other: '{{count}} sağlayıcı',
    repoCount_one: '{{count}} depo',
    repoCount_other: '{{count}} depo',
    repoAdded: '{{name}} deposu eklendi.',
    repoRemoved: '{{name}} deposu kaldırıldı.',
    repoRemoveTitle: 'Depo kaldırılsın mı?',
    repoRemoveDesc:
      '{{name}} kaldırılacak. Kurduğunuz sağlayıcılar kurulu kalır.',
    repoRefresh: 'Yenile',
    repoBack: 'Depolar',
    repoRefreshAria: '{{name}} deposunu yenile',
    repoOpenAria: '{{name}} deposunu aç',
    providerInstall: 'Kur',
    providerInstalled: 'Kurulu',
    providerInstalling: 'Kuruluyor…',
    providerInstallAll: 'Tümünü kur',
    providerInstallAria: '{{name}} sağlayıcısını kur',
  },
  settings: {
    playbackHeading: 'Oynatma',
    playbackAria: 'Oynatma ayarları',
    autoplayNext: 'Sonraki bölümü otomatik oynat',
    autoplayNextDesc: 'Bir bölüm bitince sonraki bölüm kendiliğinden başlar.',
    skipInterval: 'Atlama aralığı',
    skipIntervalDesc: 'Çift dokunma ve atlama düğmelerinin ne kadar atlayacağı.',
    holdSpeed: 'Basılı tutma hızı',
    holdSpeedDesc: 'Görüntüye basılı tutarken oynatma hızı.',
    subtitleSize: 'Altyazı boyutu',
    subtitleSizeDesc: 'Oynatıcıdaki varsayılan altyazı boyutu.',
    subtitleLanguage: 'Altyazı dili',
    subtitleLanguageDesc: 'Bir bölüm açılınca hangi altyazının seçileceği.',
    subtitleAuto: 'Uygulama dili',
    defaultVolume: 'Varsayılan ses',
    defaultVolumeDesc: 'Oynatıcının açılış ses düzeyi.',
    fillToggle: 'Ekranı doldur',
    fillToggleDesc: 'Çerçeveye sığdırmak yerine ekranı dolduracak şekilde aç.',

    contentHeading: 'İçerik',
    contentAria: 'İçerik ayarları',
    titleLanguage: 'Başlık dili',
    titleLanguageDesc: 'Bir anime için gösterilen başlık.',
    titleEn: 'İngilizce',
    titleRomaji: 'Romaji',
    titleNative: 'Japonca',
    hideAdult: 'Yetişkin içeriğini gizle',
    hideAdultDesc: 'Hentai ve yetişkin olarak derecelendirilenleri listelerden gizler.',

    storageHeading: 'Depolama',
    storageAria: 'Depolama',
    clearCache: 'Önbelleği temizle',
    clearCacheDesc: 'Önbelleğe alınan anime bilgilerini ve afişleri siler. Başka şeyi etkilemez.',
    clearExtensionsData: 'Tüm eklentileri kaldır',
    clearExtensionsDataDesc: 'Bütün eklenti ve depoları kaldırır.',
    cacheCleared: 'Önbellek temizlendi.',
    extensionsCleared: 'Tüm eklentiler kaldırıldı.',

    dataHeading: 'Veri ve gizlilik',
    dataAria: 'Veri ve gizlilik',
    clearHistory: 'İzleme geçmişini temizle',
    clearHistoryDesc: 'İzlediğiniz her bölümü ve ilerlemeyi siler.',
    clearMyList: 'Listemi temizle',
    clearMyListDesc: 'Listenize kaydedilmiş tüm animeleri kaldırır.',
    clearRecent: 'Son görüntülenenleri temizle',
    clearRecentDesc: 'Son görüntülenenler geçmişini kaldırır.',
    resetSettings: 'Ayarları sıfırla',
    resetSettingsDesc: 'Tüm uygulama ayarlarını varsayılana döndürür. Geçmiş ve listeniz kalır.',
    confirmTitle: 'Emin misiniz?',
    confirmClearHistory: 'Bu işlem cihazdaki tüm izleme geçmişini siler.',
    confirmClearMyList: 'Bu işlem Listedeki tüm başlıkları siler.',
    confirmClearRecent: 'Bu işlem son görüntülenenler listenizi siler.',
    confirmClearCache: 'Bu işlem önbelleğe alınan bilgileri siler; ağdan yeniden yüklenir.',
    confirmClearExtensions: 'Bu işlem tüm eklentileri ve depoları kaldırır.',
    confirmReset: 'Bu işlem tüm ayarları varsayılana döndürür.',
    historyCleared: 'İzleme geçmişi temizlendi.',
    myListCleared: 'Liste temizlendi.',
    recentCleared: 'Son görüntülenenler temizlendi.',
    settingsReset: 'Ayarlar sıfırlandı.',

    extensionsHeading: 'Eklentiler',
    extensionsAria: 'Eklenti ayarları',
    autoCheckUpdates: 'Açılışta güncellemeleri denetle',
    autoCheckUpdatesDesc: 'Eklentiler sayfası açıldığında depo manifestleri yenilenir.',
    manageRepos: 'Depoları ve sağlayıcıları yönet',
  },
}

const ru: Overlay = {
  status: {
    running: 'Работает',
    stopped: 'Остановлено',
    connecting: 'Подключение',
    error: 'Ошибка',
    aria: 'Состояние подключения: {{status}}',
  },
  extensions: {
    repoAdd: 'Добавить репозиторий',
    repoFormTitle: 'Добавить репозиторий по URL',
    repoUrlLabel: 'URL манифеста репозитория',
    repoUrlPlaceholder: 'https://example.com/repo/manifest.json',
    repoFormNote:
      'Манифест загружается и проверяется. Провайдеры из него устанавливаются по одному.',
    repoConfirm: 'Добавить репозиторий',
    repoSection: 'Репозитории',
    repoEmptyTitle: 'Нет репозиториев',
    repoEmptyDesc:
      'Добавьте URL манифеста, чтобы просмотреть и установить его провайдеры.',
    repoDesc:
      'Репозитории объединяют несколько провайдеров за одним URL манифеста — добавьте его и установите нужные провайдеры.',
    repoProviders_one: '{{count}} провайдер',
    repoProviders_other: '{{count}} провайдеров',
    repoCount_one: '{{count}} репозиторий',
    repoCount_other: '{{count}} репозиториев',
    repoAdded: 'Репозиторий {{name}} добавлен.',
    repoRemoved: 'Репозиторий {{name}} удалён.',
    repoRemoveTitle: 'Удалить репозиторий?',
    repoRemoveDesc:
      '{{name}} будет удалён. Установленные провайдеры останутся.',
    repoRefresh: 'Обновить',
    repoBack: 'Репозитории',
    repoRefreshAria: 'Обновить репозиторий {{name}}',
    repoOpenAria: 'Открыть репозиторий {{name}}',
    providerInstall: 'Установить',
    providerInstalled: 'Установлено',
    providerInstalling: 'Установка…',
    providerInstallAll: 'Установить все',
    providerInstallAria: 'Установить провайдер {{name}}',
  },
  settings: {
    playbackHeading: 'Воспроизведение',
    playbackAria: 'Настройки воспроизведения',
    autoplayNext: 'Автовоспроизведение следующей серии',
    autoplayNextDesc: 'Следующая серия запускается автоматически по окончании текущей.',
    skipInterval: 'Интервал перемотки',
    skipIntervalDesc: 'На сколько секунд перематывают двойное касание и кнопки.',
    holdSpeed: 'Скорость при удержании',
    holdSpeedDesc: 'Скорость воспроизведения при удержании кадра.',
    subtitleSize: 'Размер субтитров',
    subtitleSizeDesc: 'Размер субтитров по умолчанию в плеере.',
    subtitleLanguage: 'Язык субтитров',
    subtitleLanguageDesc: 'Какие субтитры выбираются при открытии серии.',
    subtitleAuto: 'Язык приложения',
    defaultVolume: 'Громкость по умолчанию',
    defaultVolumeDesc: 'Уровень громкости при открытии плеера.',
    fillToggle: 'Заполнять экран',
    fillToggleDesc: 'Открывать плеер с масштабированием на весь экран, а не по кадру.',

    contentHeading: 'Контент',
    contentAria: 'Настройки контента',
    titleLanguage: 'Язык названий',
    titleLanguageDesc: 'Какое название показывать для аниме.',
    titleEn: 'Английский',
    titleRomaji: 'Ромадзи',
    titleNative: 'Японский',
    hideAdult: 'Скрыть взрослый контент',
    hideAdultDesc: 'Скрывать хентай и материалы с взрослым рейтингом из списков.',

    storageHeading: 'Хранилище',
    storageAria: 'Хранилище',
    clearCache: 'Очистить кеш',
    clearCacheDesc: 'Удаляет кешированные данные и постеры. Больше ничего не затрагивается.',
    clearExtensionsData: 'Удалить все расширения',
    clearExtensionsDataDesc: 'Удаляет все расширения и репозитории.',
    cacheCleared: 'Кеш очищен.',
    extensionsCleared: 'Все расширения удалены.',

    dataHeading: 'Данные и приватность',
    dataAria: 'Данные и приватность',
    clearHistory: 'Очистить историю просмотра',
    clearHistoryDesc: 'Удаляет все просмотренные серии и прогресс.',
    clearMyList: 'Очистить Мой список',
    clearMyListDesc: 'Удаляет все аниме из вашего списка.',
    clearRecent: 'Очистить недавние',
    clearRecentDesc: 'Удаляет список недавно просмотренных.',
    resetSettings: 'Сбросить настройки',
    resetSettingsDesc:
      'Возвращает все настройки к значениям по умолчанию. История и список сохранятся.',
    confirmTitle: 'Вы уверены?',
    confirmClearHistory: 'Это удалит всю историю просмотра с этого устройства.',
    confirmClearMyList: 'Это удалит все тайтлы из Моего списка.',
    confirmClearRecent: 'Это удалит список недавно просмотренных.',
    confirmClearCache: 'Это удалит кешированные данные; они загрузятся заново.',
    confirmClearExtensions: 'Это удалит все расширения и репозитории.',
    confirmReset: 'Это вернёт все настройки к значениям по умолчанию.',
    historyCleared: 'История просмотра очищена.',
    myListCleared: 'Мой список очищен.',
    recentCleared: 'Недавние очищены.',
    settingsReset: 'Настройки сброшены.',

    extensionsHeading: 'Расширения',
    extensionsAria: 'Настройки расширений',
    autoCheckUpdates: 'Проверять обновления при открытии',
    autoCheckUpdatesDesc: 'Обновлять манифесты репозиториев при открытии раздела расширений.',
    manageRepos: 'Управление репозиториями и провайдерами',
  },
}

export const mobileOverlay: Record<'en' | 'tr' | 'ru', Overlay> = { en, tr, ru }
