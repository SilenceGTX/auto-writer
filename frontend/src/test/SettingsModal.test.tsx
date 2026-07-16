/** Tests for the system settings modal rendering. */
import "../i18n";
import i18n from "../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { HeroUIProvider } from "@heroui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsModal } from "../components/SettingsModal";
import { ToastProvider } from "../components/Toast";
import { AppProvider } from "../context/AppContext";

vi.mock("../api", () => ({
  getSettings: vi.fn().mockResolvedValue({
    llm_profiles: [{ id: "p1", url: "https://x/chat", api_token: "", model: "m1" }],
    llm_assignments: {
      outline_stages: "p1",
      outline_chapters: "p1",
      writing_draft: "p1",
      writing_chat: "p1",
      writing_rewrite: "p1",
      review_chat: "p1",
    },
    preferences: {
      outline: {
        temperature: 0.7,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0,
        max_tokens: 4096,
      },
      writing: {
        temperature: 0.7,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0,
        max_tokens: 4096,
      },
      review: {
        temperature: 0.3,
        top_p: 0.85,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
        max_tokens: 2048,
      },
    },
    writing_style: { text: "" },
    data_save: {
      input_debounce_seconds: 2,
      autosave_interval_seconds: 30,
      snapshot_path: "snapshots",
      history_versions: 3,
    },
    typography: { font_family: "", line_height: 1.8, reading_theme: "sepia" },
    locale: { locale: "zh" },
  }),
  exportSettings: vi.fn(),
  importSettings: vi.fn(),
  updateLlmSettings: vi.fn(),
  updatePreferences: vi.fn(),
  updateWritingStyle: vi.fn(),
  updateDataSave: vi.fn(),
  updateTypography: vi.fn(),
  updateLocale: vi.fn(),
  triggerDownload: vi.fn(),
}));

function renderModal(): ReturnType<typeof render> {
  return render(
    <HeroUIProvider>
      <AppProvider>
        <ToastProvider>
          <SettingsModal isOpen onClose={() => {}} />
        </ToastProvider>
      </AppProvider>
    </HeroUIProvider>,
  );
}

describe("SettingsModal", () => {
  beforeEach(async () => {
    localStorage.setItem("aw.locale", "zh");
    await i18n.changeLanguage("zh");
  });

  it("renders when open without crashing", async () => {
    renderModal();
    expect(await screen.findByText("系统设置")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("新增模型")).toBeInTheDocument();
    });
  });

  it("renders in English when locale is en", async () => {
    localStorage.setItem("aw.locale", "en");
    await i18n.changeLanguage("en");
    renderModal();
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Add model")).toBeInTheDocument();
    });
  });
});
