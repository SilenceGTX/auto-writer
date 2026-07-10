/** i18next bootstrap for Auto-Writer UI translations (``designs/I18N.md`` §4.1). */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveBootstrapLocale } from "../utils/locale";

import enCommon from "../locales/en/common.json";
import enConcept from "../locales/en/concept.json";
import enErrors from "../locales/en/errors.json";
import enInspiration from "../locales/en/inspiration.json";
import enNav from "../locales/en/nav.json";
import enOutline from "../locales/en/outline.json";
import enReview from "../locales/en/review.json";
import enSettings from "../locales/en/settings.json";
import enWorks from "../locales/en/works.json";
import enWriting from "../locales/en/writing.json";
import zhCommon from "../locales/zh/common.json";
import zhConcept from "../locales/zh/concept.json";
import zhErrors from "../locales/zh/errors.json";
import zhInspiration from "../locales/zh/inspiration.json";
import zhNav from "../locales/zh/nav.json";
import zhOutline from "../locales/zh/outline.json";
import zhReview from "../locales/zh/review.json";
import zhSettings from "../locales/zh/settings.json";
import zhWorks from "../locales/zh/works.json";
import zhWriting from "../locales/zh/writing.json";

export const I18N_NAMESPACES = [
  "common",
  "nav",
  "works",
  "outline",
  "writing",
  "review",
  "concept",
  "inspiration",
  "settings",
  "errors",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    zh: {
      common: zhCommon,
      nav: zhNav,
      works: zhWorks,
      outline: zhOutline,
      writing: zhWriting,
      review: zhReview,
      concept: zhConcept,
      inspiration: zhInspiration,
      settings: zhSettings,
      errors: zhErrors,
    },
    en: {
      common: enCommon,
      nav: enNav,
      works: enWorks,
      outline: enOutline,
      writing: enWriting,
      review: enReview,
      concept: enConcept,
      inspiration: enInspiration,
      settings: enSettings,
      errors: enErrors,
    },
  },
  lng: resolveBootstrapLocale(),
  fallbackLng: "zh",
  defaultNS: "common",
  ns: [...I18N_NAMESPACES],
  interpolation: { escapeValue: false },
});

export default i18n;
