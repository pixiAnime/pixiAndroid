/**
 * Recursos en español — tipado como `typeof en`, de modo que una clave que
 * falta o sobra es un error de compilación.
 *
 * A diferencia de en/tr/ru, este archivo **no** viene de ../pixiWeb: es el
 * único paquete de idioma propiedad de este repositorio. Si algún día el web
 * añade español, este archivo debe borrarse del manifiesto de sincronización
 * en lugar de mantenerse como copia (ver shared-manifest.json).
 *
 * Los plurales en español son como los del inglés (`_one` / `_other`), así que
 * los buckets coinciden con `en`.
 */
import type { en } from './en'

export const es: typeof en = {
  nav: {
    home: 'Inicio',
    browse: 'Explorar',
    search: 'Buscar',
    settings: 'Ajustes',
    extensions: 'Extensiones',
    history: 'Historial',
    myList: 'Mi lista',
  },

  common: {
    watch: 'Ver',
    continue: 'Continuar',
    details: 'Detalles',
    close: 'Cerrar',
    viewAll: 'Ver todo',
    tryAgain: 'Reintentar',
    cancel: 'Cancelar',
    clear: 'Limpiar',
    reset: 'Restablecer',
    remove: 'Quitar',
    loadMore: 'Cargar más',
    watchNow: 'Ver ahora',
    backHome: 'Volver al inicio',
    searchAnime: 'Buscar anime',
    searchAnimePlaceholder: 'Buscar anime…',
    nothingHere: 'Aquí no hay nada todavía',
    loading: 'cargando…',
    loadingEpisodes: 'Cargando episodios…',
    episode: 'Episodio {{num}}',
    listedCount_one: '{{count}} en la lista',
    listedCount_other: '{{count}} en la lista',
    openAria: 'Abrir {{title}}',
    iconAlt: 'Icono de {{name}}',
    posterAlt: 'Cartel de {{title}}',
    imageUnavailableAria: '{{alt}} — imagen no disponible',
    yes: 'sí',
    no: 'no',
    none: 'ninguno',
    unknown: 'desconocido',
    score: 'puntuación',
    streaming: 'Transmitiendo',
    subtitles: 'Subtítulos',
  },

  a11y: {
    mainNav: 'Principal',
    mobileNav: 'Móvil',
    footerNav: 'Pie de página',
    skipToContent: 'Saltar al contenido',
    watchProgress: 'Progreso de visualización',
    watchProgressFor: 'Progreso de visualización de {{title}}',
    scrollLeft: 'Desplazar {{title}} a la izquierda',
    scrollRight: 'Desplazar {{title}} a la derecha',
    genres: 'Géneros',
    genresAndThemes: 'Géneros y temas',
  },

  footer: {
    metaBy: 'Metadatos de anime por',
    jikan: 'Jikan / MyAnimeList',
    bridgeBy: '. Puente local de pixiClient.',
    bridgeLabel: 'puente:',
  },

  indicator: {
    connecting: 'Conectando…',
    online: 'Conectado',
    offline: 'Sin conexión',
    aria: 'pixiClient: {{status}}',
    ariaOffline: 'pixiClient: {{status}} — pulsa para obtener ayuda',
    titleOffline: 'pixiClient no está conectado — pulsa para obtener ayuda',
    titleOnline: 'El puente de pixiClient está accesible',
  },

  offline: {
    title: 'pixiClient no está conectado.',
    description:
      'Algunas funciones del sitio necesitan que pixiClient haga las peticiones a través de tu dispositivo Android. Instala e inicia pixiClient para continuar.',
    lnaDescription:
      'Este navegador está bloqueando que este sitio alcance la red local donde se ejecuta pixiClient (se denegó el acceso a la red local), así que todas las peticiones del puente fallan aunque pixiClient esté en ejecución.',
    lnaHowTo:
      'Permítelo para este sitio: pulsa el icono junto a la barra de direcciones → Ajustes del sitio → Acceso a la red local → Permitir y después pulsa Reintentar la conexión.',
    bridgeLabel: 'puente',
    statusLabel: 'estado',
    retrying: 'Reintentando…',
    retry: 'Reintentar la conexión',
    download: 'Descargar pixiClient',
    noDownloadTitle: 'No hay URL de descarga configurada — define VITE_PIXICLIENT_DOWNLOAD_URL',
    noDownloadNoteBefore: 'Todavía no hay ninguna URL de descarga configurada. Define',
    noDownloadNoteAfter: 'para activar el botón de descarga.',
  },

  errors: {
    rateLimited: {
      title: 'Ve más despacio',
      description:
        'La API de anime está limitando las peticiones en este momento. Espera unos segundos y vuelve a intentarlo.',
    },
    notFound: {
      title: 'Anime no encontrado',
      description: 'Este anime no existe o el identificador no es válido.',
    },
    badRequest: {
      title: 'Petición no válida',
      description:
        'Algunos de los filtros seleccionados no son válidos. Ajústalos y vuelve a intentarlo.',
    },
    jikanUnavailable: {
      title: 'API de anime no disponible',
      description:
        'El servicio de metadatos de anime está teniendo problemas. Suele ser temporal.',
    },
    network: {
      title: 'Problema de conexión',
      description: 'No se pudo conectar con la API de anime. Comprueba tu conexión.',
    },
    unexpected: {
      title: 'Algo salió mal',
      description: 'Se recibió una respuesta inesperada. Vuelve a intentarlo.',
      descriptionAlt: 'Ocurrió un error inesperado. Vuelve a intentarlo.',
    },
    bridgeOffline: {
      title: 'pixiClient no está conectado',
      description:
        'Esta función necesita que pixiClient enrute la petición a través de tu dispositivo Android.',
    },
    bridgeError: {
      title: 'La petición del puente falló',
      unauthorized:
        'pixiClient necesita un token de autenticación. Defínelo en la aplicación en Ajustes → Seguridad.',
      blocked: 'El destino está bloqueado por la política de seguridad del puente.',
      timeout: 'El servidor de destino tardó demasiado en responder.',
      connectionFailed: 'No se pudo conectar con el servidor de destino.',
      invalid: 'El puente rechazó la petición por no ser válida.',
      generic: 'El puente informó de un error al realizar la petición.',
    },
  },

  routeError: {
    notFound: 'Página no encontrada.',
    requestFailed: 'La petición falló ({{status}}).',
    generic: 'Algo salió mal al cargar esta página.',
    title: 'Error inesperado',
  },

  notFound: {
    title: 'Página no encontrada',
    description: 'La página que buscas no existe o el enlace está desactualizado.',
    searchCta: 'Buscar anime',
  },

  hero: {
    featured: 'Destacado',
    episodes_one: '{{count}} episodio',
    episodes_other: '{{count}} episodios',
  },

  home: {
    continueWatching: 'Seguir viendo',
    continueWatchingAria: 'Seguir viendo',
    noResultsTitle: 'Sin resultados',
    noResultsDesc: 'Ahora mismo no hay nada que mostrar en esta sección.',
    inProgress_one: '{{count}} en curso',
    inProgress_other: '{{count}} en curso',
    rows: {
      trending: 'En tendencia',
      popular: 'Más populares',
      topRated: 'Mejor valorados',
      airing: 'En emisión',
      thisSeason: 'Esta temporada',
      upcoming: 'Próximamente',
      recentlyUpdated: 'Actualizados recientemente',
    },
    subs: {
      topAiring: 'en emisión',
      byPopularity: 'por popularidad',
      allTime: 'histórico',
    },
  },

  browse: {
    description:
      'Combina género, tipo, estado, temporada, año, clasificación y orden — los filtros se reflejan en la URL.',
    type: 'Tipo',
    status: 'Estado',
    season: 'Temporada',
    year: 'Año',
    rating: 'Clasificación',
    sortBy: 'Ordenar por',
    genres: 'Géneros',
    selected_one: '({{count}} seleccionado)',
    selected_other: '({{count}} seleccionados)',
    emptyTitle: 'Ningún anime coincide con estos filtros',
    emptyDesc: 'Prueba a quitar un filtro o elegir otro género.',
    titles_one: '{{count}} título',
    titles_other: '{{count}} títulos',
    options: {
      anyType: 'Cualquier tipo',
      tv: 'TV',
      movie: 'Película',
      ova: 'OVA',
      ona: 'ONA',
      special: 'Especial',
      music: 'Música',
      anyStatus: 'Cualquier estado',
      airing: 'En emisión',
      complete: 'Finalizado',
      upcoming: 'Próximamente',
      anySeason: 'Cualquier temporada',
      winter: 'Invierno',
      spring: 'Primavera',
      summer: 'Verano',
      fall: 'Otoño',
      anyRating: 'Cualquier clasificación',
      anyYear: 'Cualquier año',
      score: 'Puntuación',
      popularity: 'Popularidad',
      members: 'Miembros',
      favorites: 'Favoritos',
      startDate: 'Fecha de inicio',
      title: 'Título',
      recentlyUpdated: 'Actualizado recientemente',
    },
  },

  search: {
    description: 'Busca por títulos en inglés, japonés y romaji, además de sinónimos.',
    clearAria: 'Borrar la búsqueda',
    startTitle: 'Empieza a escribir para buscar',
    startDesc:
      'Prueba con un título en inglés, japonés o romaji — p. ej. «Frieren», «葬送のフリーレン», «Shigatsu».',
    noResults: 'Sin resultados para «{{query}}»',
    noResultsDesc: 'Revisa la ortografía o prueba con una búsqueda más corta.',
    results_one: '{{count}} resultado',
    results_other: '{{count}} resultados',
    updating: 'actualizando…',
    loadMoreResults: 'Cargar más resultados',
  },

  details: {
    externalLabel: 'Externo',
    externalValue: 'MyAnimeList ↗',
    aka: 'También conocido como: {{list}}',
    srcBadge: 'src: {{source}}',
    stats: {
      score: 'Puntuación',
      rank: 'Puesto',
      popularity: 'Popularidad',
      members: 'Miembros',
      favorites: 'Favoritos',
    },
    meta: {
      aired: 'Emitido',
      status: 'Estado',
      episodes: 'Episodios',
      duration: 'Duración',
      rating: 'Clasificación',
      source: 'Fuente',
      studios: 'Estudios',
      producers: 'Productoras',
      licensors: 'Distribuidoras',
    },
    synopsis: 'Sinopsis',
    information: 'Información',
    watchH2: 'Ver',
    continueWithEp: 'Continuar con el episodio {{num}}',
    startWithEp: 'Empezar con el episodio {{num}}',
    episodesDuration_one: '{{count}} episodio · {{duration}}',
    episodesDuration_other: '{{count}} episodios · {{duration}}',
    durationUnknown: 'duración desconocida',
    watchDescFallback:
      'Los metadatos de los episodios vienen de Jikan — el proveedor de transmisión se conecta aquí más adelante.',
    openPlayer: 'Abrir el reproductor',
    watchAria: 'Ver {{title}}',
    continueEp: 'Continuar · Ep. {{num}}',
    characters: 'Personajes',
    noCharacters: 'Sin datos de personajes',
    related: 'Títulos relacionados',
    recommendations: 'Recomendaciones',
    noRecommendations: 'Todavía no hay recomendaciones',
  },

  watch: {
    openExtensions: 'Abrir Extensiones',
    noExtsTitle: 'No hay extensiones de transmisión',
    noExtsDesc:
      'Instala una extensión de transmisión para reproducir este episodio. Las extensiones se añaden por URL, se ejecutan aisladas y pasan por pixiClient.',
    noSourcesTitle: 'No se encontraron fuentes',
    noSourcesFailedDesc:
      'Las extensiones instaladas no pudieron encontrar una fuente reproducible para este episodio.',
    noSourcesNoneDesc: 'Ninguna extensión activa devolvió una fuente para este episodio.',
    resolving: 'Buscando la fuente…',
    subNotes: 'Notas del proveedor de subtítulos',
    provNotes: 'Notas del proveedor',
    prev: 'Ant.',
    prevAria: 'Episodio anterior',
    next: 'Sig.',
    nextAria: 'Episodio siguiente',
    info: 'Info',
    infoAria: 'Información del anime',
    lastWatched: 'Visto por última vez: episodio {{num}}',
    jumpBack: 'Retroceder',
    animeInfo: 'Información del anime',
    epsUnit: 'eps.',
    epsCount_one: '{{count}} ep.',
    epsCount_other: '{{count}} eps.',
    episodes: 'Episodios',
    totalCount_one: '{{count}} en total',
    totalCount_other: '{{count}} en total',
    noEpisodesTitle: 'Sin datos de episodios',
    noEpisodesDesc: 'Jikan todavía no tiene una lista de episodios para este título.',
    prevPage: '← Página anterior',
    nextPage: 'Página siguiente →',
    pageOf: 'página {{page}} de {{pages}}',
    metaPrefix: 'Metadatos de episodios: Jikan · reproducción:',
    extensionsCount_one: '{{count}} extensión',
    extensionsCount_other: '{{count}} extensiones',
    noExtensions: 'sin extensiones',
    installOne: '— instala una desde la pantalla de Extensiones',
    sourceCount_one: '{{count}} fuente',
    sourceCount_other: '{{count}} fuentes',
  },

  player: {
    source: 'Fuente',
    sourcesAria: 'Fuentes',
    available_one: '{{count}} disponible',
    available_other: '{{count}} disponibles',
    providers_one: '{{count}} proveedor',
    providers_other: '{{count}} proveedores',
    sourceVia: '{{parts}} vía {{provider}}',
    tracks_one: '{{count}} pista',
    tracks_other: '{{count}} pistas',
    off: 'Desactivados',
    subsOffAria: 'Subtítulos desactivados',
    subsForAria: 'Subtítulos: {{label}} ({{language}}, {{format}})',
    assNote: 'El renderizado ASS todavía no está disponible',
    delayLabel: 'Retardo',
    delayDecrease: 'Reducir el retardo de los subtítulos',
    delayIncrease: 'Aumentar el retardo de los subtítulos',
    delayReset: 'Restablecer el retardo de los subtítulos',
    syncAria: 'Sincronización de subtítulos',
    filler: 'relleno',
    recap: 'repaso',
    watched: 'visto',
    now: 'ahora',
  },

  history: {
    emptyTitle: 'Todavía no hay historial de visualización',
    emptyDesc:
      'Abre la página de visionado de un anime y tu historial aparecerá aquí.',
    subtitleCount_one:
      '{{count}} anime en tu lista de «seguir viendo» · guardado localmente en este navegador',
    subtitleCount_other:
      '{{count}} anime en tu lista de «seguir viendo» · guardado localmente en este navegador',
    subtitleEmpty: 'Guardado localmente en este navegador',
    clearTitle: '¿Borrar el historial de visualización?',
    clearAction: 'Borrar el historial',
    clearDesc_one:
      'Esto elimina las {{count}} entrada del historial guardada en este navegador. No se puede deshacer.',
    clearDesc_other:
      'Esto elimina las {{count}} entradas del historial guardadas en este navegador. No se puede deshacer.',
    progress: '{{percent}} % visto',
    removeAria: 'Quitar {{title}} del historial',
  },

  myList: {
    emptyTitle: 'Tu lista está vacía',
    emptyDesc:
      'Añade anime desde cualquier página de detalles — aparecerán aquí, guardados en este navegador.',
    subtitleCount_one: '{{count}} anime guardado · guardado localmente en este navegador',
    subtitleCount_other: '{{count}} anime guardados · guardados localmente en este navegador',
    subtitleEmpty: 'Los anime guardados aparecen aquí',
    added: 'añadido {{when}}',
    inList: 'En Mi lista',
    addTo: 'Añadir a Mi lista',
    removeAria: 'Quitar {{title}} de Mi lista',
  },

  extensions: {
    pageDesc:
      'Añade proveedores de transmisión y subtítulos por URL. Las extensiones se ejecutan aisladas, reciben identificadores de MAL / AniList y hacen cada petición de red a través de pixiClient.',
    add: 'Añadir extensión',
    offlineNote:
      'pixiClient no está conectado — instalar extensiones y reproducir contenido requieren el puente.',
    connectionDetails: 'Detalles de la conexión',
    installFromUrl: 'Instalar desde una URL',
    urlLabel: 'URL de la extensión',
    urlPlaceholder: 'https://example.com/extensions/provider.js',
    validating: 'Validando…',
    install: 'Instalar',
    installNote:
      'El módulo se descarga a través de pixiClient, se evalúa en un entorno aislado y se valida antes de instalar nada.',
    confirmInstall: 'Confirmar la instalación',
    discard: 'Descartar',
    installedList: 'Extensiones instaladas',
    totalCount_one: '{{count}} en total',
    totalCount_other: '{{count}} en total',
    loading: 'Cargando extensiones…',
    emptyTitle: 'No hay extensiones instaladas',
    emptyDesc:
      'Añade una extensión de transmisión o de subtítulos por URL. Consulta docs/extensions.md para la guía de desarrollo.',
    enabled: 'Activada',
    disabled: 'Desactivada',
    disabledBadge: 'Sin peticiones mientras esté desactivada',
    detailsForAria: 'Detalles de {{name}}',
    checkUpdate: 'Buscar actualizaciones',
    updateNow: 'Actualizar ahora',
    installedX: '{{name}} instalada (v{{version}}).',
    reinstalledX: '{{name}} reinstalada (v{{version}}).',
    updatedX: '{{name}} actualizada a la v{{version}}.',
    removedX: '{{name}} eliminada.',
    updateWrongExt: 'La URL ahora sirve una extensión distinta.',
    updateAvailable: 'Actualización disponible: v{{from}} → v{{to}}.',
    updateCurrent: 'Estás al día (v{{version}}).',
    updateNewer: 'La versión instalada es más nueva que la de la URL.',
    detailsTitle: 'Detalles de la extensión',
    rowUrl: 'url:',
    rowApi: 'versión de la api:',
    rowCaps: 'capacidades:',
    rowMethods: 'métodos:',
    rowInstalled: 'instalada:',
    rowUpdated: 'actualizada:',
    rowEnabled: 'activada:',
    removeTitle: '¿Eliminar la extensión?',
    removeDesc:
      '{{name}} se eliminará y dejará de hacer peticiones de inmediato. Puedes volver a instalarla más tarde desde la misma URL.',
  },

  settings: {
    pageDesc: 'Secciones e información de la aplicación — el historial, Mi lista y Extensiones viven aquí.',
    sectionsAria: 'Secciones',
    sectionHistoryDesc:
      'Seguir viendo — los episodios que reprodujiste, guardados en este navegador.',
    sectionMyListDesc: 'Tus favoritos y tu lista de seguimiento, guardados localmente.',
    sectionExtensionsDesc:
      'Instala, activa y actualiza proveedores de transmisión y subtítulos por URL.',
    languageAria: 'Idioma',
    languageHeading: 'Idioma',
    languageDesc:
      'Se detecta a partir de tu navegador hasta que elijas uno — tu elección se recuerda en este dispositivo.',
    aboutAria: 'Acerca de',
    aboutHeading: 'Acerca de',
    aboutData: 'Datos de anime',
    aboutDataValue: 'Jikan / MyAnimeList con AniList como alternativa',
    aboutPlayback: 'Reproducción',
    aboutPlaybackValue: 'vía el puente de pixiClient · {{url}}',
    aboutStorage: 'Almacenamiento',
    aboutStorageValue: 'almacenamiento local (lista, historial, caché) · IndexedDB (extensiones)',
    aboutPrivacy: 'Privacidad',
    aboutPrivacyValue: 'Todo permanece en este navegador — sin cuentas ni servidor',
  },

  time: {
    justNow: 'ahora mismo',
    minutesAgo_one: 'hace {{count}} min',
    minutesAgo_other: 'hace {{count}} min',
    hoursAgo_one: 'hace {{count}} h',
    hoursAgo_other: 'hace {{count}} h',
    daysAgo_one: 'hace {{count}} d',
    daysAgo_other: 'hace {{count}} d',
  },

  /**
   * Diagnósticos fijos del runtime de extensiones. Como en `tr` y `ru`, el
   * valor español es lo que se muestra; la clave sigue siendo la que
   * `ext-messages.ts` busca al traducir un mensaje dynamic.
   */
  extMsg: {
    timeoutRespond: 'La extensión tardó demasiado en responder.',
    timeoutLoad: 'La extensión tardó demasiado en cargarse.',
    timeoutRequest: 'La petición tardó demasiado y se canceló.',
    noLongerAvailable: 'La extensión ya no está disponible.',
    sandboxUnavailable: 'No se pudo cargar la extensión en este navegador.',
    loadFailed: 'No se pudo cargar la extensión.',
    generic: 'La extensión falló al procesar la petición.',
    pixiNotRunning: 'pixiClient no está en ejecución.',
    pixiUnreachable: 'No se puede contactar con pixiClient',
    bridgeRequest: 'El puente no pudo completar la petición.',
    bridgeLoadStream: 'El puente no pudo cargar esta emisión.',
    streamLoad: 'No se pudo cargar la emisión.',
    streamPlaylist: 'La emisión devolvió una lista de reproducción no válida.',
    httpFailed: 'No se pudo completar la petición.',
    httpTooLarge: 'La respuesta era demasiado grande para procesarla.',
    fileNotLoaded: 'No se pudo cargar el archivo de la extensión.',
    noManifest: 'La extensión no exporta un manifiesto.',
    manifestUnusable: 'El manifiesto de la extensión contiene datos inutilizables.',
    invalidData: 'La extensión devolvió datos que no se pueden usar.',
    noSourcesResult: 'La extensión no devolvió una lista de fuentes.',
    noSubtitlesResult: 'La extensión no devolvió una lista de subtítulos.',
    invalidUrl: 'Introduce una URL de extensión válida que empiece por http:// o https://.',
    downloadFailed: 'No se pudo descargar la extensión. Comprueba la URL e inténtalo de nuevo.',
    downloadTimeout: 'La descarga tardó demasiado. Comprueba la URL e inténtalo de nuevo.',
    fileTooLarge: 'El archivo de la extensión es demasiado grande.',
    fileEmpty: 'El archivo de la extensión está vacío.',
    preInstallNetwork: 'No hay acceso a la red disponible antes de la instalación.',
    badUrlFromExt: 'La extensión proporcionó una URL no válida.',
    onlyHttp: 'Solo se permiten URL http(s).',
    overLongUrl: 'La extensión construyó una URL demasiado larga.',
    bodyTooLarge: 'El cuerpo de la petición es demasiado grande.',
    iconInvalid: 'El campo «icon» del manifiesto debe ser una URL http(s) válida.',
    capsMismatch: 'Las capacidades del manifiesto no coinciden con los métodos implementados.',
    typeMismatch: 'El tipo del manifiesto no coincide con los métodos implementados.',
    neitherMethods: 'La extensión no implementa ni getSources() ni getSubtitles().',
    noValidManifest: 'La extensión no exporta un manifiesto válido.',
    idInvalid:
      'El campo «id» del manifiesto debe ser minúsculas, dígitos, puntos, guiones o guiones bajos.',
    versionInvalid: 'El campo «version» del manifiesto debe tener forma 1.0.0.',
    apiTooNew: 'Esta extensión necesita una versión más reciente de la API de extensiones.',
    // reproductor (preparación de la reproducción)
    playerCannotPlay: 'Este navegador no puede reproducir este formato de emisión.',
    playbackFailed: 'La reproducción falló — no se pudo cargar la emisión.',
    playbackNotStarted: 'No se pudo iniciar la reproducción.',
    streamNotPlayed: 'No se pudo reproducir esta emisión.',
  },
}