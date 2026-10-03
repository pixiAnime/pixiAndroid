/**
 * i18n bootstrap — English, Türkçe, Русский.
 *
 * Detection: saved choice → device language (from `Intl`, since React Native
 * exposes no `navigator.languages`) → English. The choice made in Settings
 * is persisted and always wins over the device language.
 */
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocalStorage } from '@/platform/storage/localStorage'
import { en } from './resources/en'
import { tr } from './resources/tr'
import { ru } from './resources/ru'
import { localizeExtensionMessage } from './ext-messages'
import { mobileOverlay } from './mobile'

/**
 * Deep-merge the mobile-only overlay into a shared resource bundle. The
 * overlay only adds keys (never overrides shared ones), so the synced web copy
 * stays the source of truth for everything it defines.
 */
function withMobileOverlay<T extends object, U extends object>(base: T, extra: U): T & U {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key]
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? { ...(current as object), ...(value as object) }
        : value
  }
  return out as T & U
}

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const LANGUAGE_STORAGE_KEY = 'pixiweb.lang'

function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value)
}

/** Device locale tags, most specific first (Hermes ships `Intl`). */
function systemLanguages(): string[] {
  try {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale
    if (typeof locale === 'string' && locale.length > 0) return [locale]
  } catch {
    /* Intl unavailable — English fallback below */
  }
  return ['en']
}

/** Saved choice → device language → English. */
function detectLanguage(): LanguageCode {
  try {
    const stored = getLocalStorage().getItem(LANGUAGE_STORAGE_KEY)
    if (isLanguageCode(stored)) return stored
  } catch {
    /* storage unavailable — fall through */
  }
  for (const raw of systemLanguages()) {
    const base = raw?.split('-')[0]?.toLowerCase()
    if (isLanguageCode(base)) return base
  }
  return 'en'
}

/** Persist + apply a language (Settings menu). */
export function setLanguage(code: LanguageCode): void {
  try {
    getLocalStorage().setItem(LANGUAGE_STORAGE_KEY, code)
  } catch {
    /* storage unavailable — language still applies for this session */
  }
  i18next.changeLanguage(code).catch(() => {
    /* the language still applies for this session */
  })
}

if (!i18next.isInitialized) {
  i18next
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: withMobileOverlay(en, mobileOverlay.en) },
        tr: { translation: withMobileOverlay(tr, mobileOverlay.tr) },
        ru: { translation: withMobileOverlay(ru, mobileOverlay.ru) },
      },
      lng: detectLanguage(),
      fallbackLng: 'en',
      interpolation: { escapeValue: false }, // React escapes output
      returnNull: false,
    })
    .catch(() => {
      /* i18next falls back to the resource bundle it already has */
    })
}

export { i18next as i18n, localizeExtensionMessage }
