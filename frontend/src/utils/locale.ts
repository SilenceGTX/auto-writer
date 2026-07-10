/** Browser locale detection and ``<html lang>`` helpers (``designs/I18N.md``). */

export type AppLocale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "aw.locale";

/** Return whether *value* is a supported application locale. */
export function isAppLocale(value: string): value is AppLocale {
  return value === "zh" || value === "en";
}

/** Guess the initial locale from ``navigator.language``, falling back to Chinese. */
export function detectBrowserLocale(): AppLocale {
  const language = navigator.language.toLowerCase();
  if (language.startsWith("en")) {
    return "en";
  }
  if (language.startsWith("zh")) {
    return "zh";
  }
  return "zh";
}

/** Read a previously persisted locale from ``localStorage``, if valid. */
export function readStoredLocale(): AppLocale | null {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored && isAppLocale(stored) ? stored : null;
}

/** Resolve the locale used before settings are loaded from the API. */
export function resolveBootstrapLocale(): AppLocale {
  return readStoredLocale() ?? detectBrowserLocale();
}

/** Keep the document ``lang`` attribute in sync with the active locale. */
export function applyHtmlLang(locale: AppLocale): void {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}
