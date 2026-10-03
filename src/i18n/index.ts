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
        en: { translation: en },
        tr: { translation: tr },
        ru: { translation: ru },
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
