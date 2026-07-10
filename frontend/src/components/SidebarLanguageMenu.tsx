/** Sidebar language picker: globe icon, current label, and immediate locale switch. */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Globe } from "lucide-react";
import { updateLocale } from "../api";
import { useApp } from "../context/AppContext";
import { useToast } from "./Toast";
import type { AppLocale } from "../utils/locale";

const LOCALE_OPTIONS: AppLocale[] = ["zh", "en"];

const LOCALE_LABEL_KEYS: Record<AppLocale, "languageZh" | "languageEn"> = {
  zh: "languageZh",
  en: "languageEn",
};

/** Render the footer language dropdown above the theme toggle. */
export function SidebarLanguageMenu(): ReactElement {
  const { t } = useTranslation("nav");
  const { locale, setLocale } = useApp();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleChange(next: AppLocale): Promise<void> {
    if (next === locale || saving) {
      return;
    }
    setSaving(true);
    setLocale(next);
    try {
      await updateLocale({ locale: next });
    } catch {
      notify(t("languageSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dropdown placement="top-start">
      <DropdownTrigger>
        <button className="nav-item" type="button" aria-label={t("language")}>
          <Globe size={18} />
          <span>{t(LOCALE_LABEL_KEYS[locale])}</span>
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t("language")}
        selectionMode="single"
        selectedKeys={[locale]}
        onSelectionChange={(keys) => {
          const value = Array.from(keys)[0] as AppLocale | undefined;
          if (value) {
            void handleChange(value);
          }
        }}
      >
        {LOCALE_OPTIONS.map((option) => (
          <DropdownItem key={option}>{t(LOCALE_LABEL_KEYS[option])}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
