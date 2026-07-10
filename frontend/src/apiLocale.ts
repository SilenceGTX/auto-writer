/** Request locale state shared by the API client and application context. */

import type { AppLocale } from "./utils/locale";

let requestLocale: AppLocale = "zh";

/** Set the locale attached to outgoing API requests. */
export function setApiLocale(locale: AppLocale): void {
  requestLocale = locale;
}

/** Return the locale currently attached to API requests. */
export function getApiLocale(): AppLocale {
  return requestLocale;
}
