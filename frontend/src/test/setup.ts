/** Vitest global setup: extends expect with jest-dom matchers and cleans up the DOM. */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "../i18n";
import i18n from "../i18n";
import { LOCALE_STORAGE_KEY } from "../utils/locale";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = ResizeObserverStub;

/** Default tests to Chinese UI copy; individual suites may override (e.g. English i18n tests). */
beforeEach(async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, "zh");
  await i18n.changeLanguage("zh");
});

afterEach(() => {
  cleanup();
});
