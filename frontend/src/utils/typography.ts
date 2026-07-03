/** Apply reading typography settings to the document via CSS variables.
 *
 * Reading surfaces (the review reader and the chapter editor) consume the
 * ``--reading-font-family`` / ``--reading-line-height`` CSS variables and the
 * ``data-reading-theme`` attribute set here, so updating settings re-themes the
 * whole app without threading state through every component.
 */
import type { TypographySettings } from "../api";

/** Push typography settings onto the document root so reading surfaces react. */
export function applyTypography(typography: TypographySettings): void {
  const root = document.documentElement;
  root.style.setProperty("--reading-font-family", typography.font_family || "inherit");
  root.style.setProperty("--reading-line-height", String(typography.line_height || 1.8));
  root.setAttribute("data-reading-theme", typography.reading_theme);
}
