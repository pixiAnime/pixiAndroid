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
 * shared `en` bundle.
 */

export const mobileKeys = {
  running: 'status.running',
  stopped: 'status.stopped',
  connecting: 'status.connecting',
  error: 'status.error',
  aria: 'status.aria',
} as const

type Overlay = {
  status: {
    running: string
    stopped: string
    connecting: string
    error: string
    aria: string
  }
}

const en: Overlay = {
  status: {
    running: 'Running',
    stopped: 'Stopped',
    connecting: 'Connecting',
    error: 'Error',
    aria: 'Connection status: {{status}}',
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
}

const ru: Overlay = {
  status: {
    running: 'Работает',
    stopped: 'Остановлено',
    connecting: 'Подключение',
    error: 'Ошибка',
    aria: 'Состояние подключения: {{status}}',
  },
}

export const mobileOverlay: Record<'en' | 'tr' | 'ru', Overlay> = { en, tr, ru }
