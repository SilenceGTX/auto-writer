/** System settings modal: LLM profiles, assignments, preferences, and more.
 *
 * Covers all tabs of ``SYSTEM_SETTINGS_PAGE_DESIGN.md`` (§3–8).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import {
  exportSettings,
  getSettings,
  importSettings,
  triggerDownload,
  updateDataSave,
  updateLlmSettings,
  updatePreferences,
  updateTypography,
  updateWritingStyle,
  type AppSettings,
  type ConnectionSettings,
  type DataSaveSettings,
  type LLMAssignments,
  type LLMProfile,
  type Preferences,
  type ReadingTheme,
  type TypographySettings,
} from "../api";
import { useApp } from "../context/AppContext";
import {
  DEFAULT_REVIEW_PREFERENCE,
  DEFAULT_STAGE_PREFERENCE,
} from "../utils/preferences";
import {
  MAX_LLM_PROFILES,
  createEmptyProfile,
  defaultAssignments,
  fallbackAssignments,
  profileLabel,
} from "../utils/llmSettings";
import { applyTypography } from "../utils/typography";
import { useToast } from "./Toast";
import { LLMAssignmentPanel } from "./settings/LLMAssignmentPanel";
import { LLMProfileFields } from "./settings/LLMProfileFields";
import { StagePreferenceEditor } from "./settings/StagePreferenceEditor";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_PREFERENCES: Preferences = {
  outline: { ...DEFAULT_STAGE_PREFERENCE },
  writing: { ...DEFAULT_STAGE_PREFERENCE },
  review: { ...DEFAULT_REVIEW_PREFERENCE },
};
const DEFAULT_DATA_SAVE: DataSaveSettings = {
  input_debounce_seconds: 2,
  autosave_interval_seconds: 30,
  snapshot_path: "snapshots",
  history_versions: 3,
};
const DEFAULT_TYPOGRAPHY: TypographySettings = {
  font_family: "",
  line_height: 1.8,
  reading_theme: "sepia",
};

const READING_THEME_KEYS: ReadingTheme[] = ["sepia", "light", "dark"];

function normalizePreferences(preferences: Preferences): Preferences {
  return {
    outline: preferences.outline ?? { ...DEFAULT_STAGE_PREFERENCE },
    writing: preferences.writing ?? { ...DEFAULT_STAGE_PREFERENCE },
    review: preferences.review ?? { ...DEFAULT_REVIEW_PREFERENCE },
  };
}

function normalizeLoadedSettings(
  data: AppSettings & { connection?: ConnectionSettings },
): { profiles: LLMProfile[]; assignments: LLMAssignments } {
  let profiles = data.llm_profiles;
  if (!profiles?.length) {
    if (data.connection) {
      profiles = [
        {
          id: crypto.randomUUID(),
          url: data.connection.url ?? "",
          api_token: data.connection.api_token ?? "",
          model: data.connection.model ?? "",
        },
      ];
    } else {
      profiles = [createEmptyProfile()];
    }
  }
  return {
    profiles,
    assignments: data.llm_assignments ?? defaultAssignments(profiles),
  };
}

/** Render the system settings modal with editable settings groups. */
export function SettingsModal(props: SettingsModalProps): ReactElement {
  const { t } = useTranslation(["settings", "common"]);
  const { notify } = useToast();
  const { setLocale } = useApp();
  const initialProfile = createEmptyProfile();
  const [llmProfiles, setLlmProfiles] = useState<LLMProfile[]>([initialProfile]);
  const [llmAssignments, setLlmAssignments] = useState<LLMAssignments>(() =>
    defaultAssignments([initialProfile]),
  );
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [writingStyle, setWritingStyle] = useState("");
  const [dataSave, setDataSave] = useState<DataSaveSettings>(DEFAULT_DATA_SAVE);
  const [typography, setTypography] = useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  const [saving, setSaving] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const applyLoaded = useCallback((data: AppSettings & { connection?: ConnectionSettings }) => {
    const { profiles, assignments } = normalizeLoadedSettings(data);
    setLlmProfiles(profiles);
    setLlmAssignments(assignments);
    setPreferences(normalizePreferences(data.preferences ?? DEFAULT_PREFERENCES));
    setWritingStyle(data.writing_style?.text ?? "");
    setDataSave(data.data_save ?? DEFAULT_DATA_SAVE);
    setTypography(data.typography ?? DEFAULT_TYPOGRAPHY);
  }, []);

  const load = useCallback(async () => {
    try {
      applyLoaded(await getSettings());
    } catch {
      notify(t("settings:loadFailed"), "error");
    }
  }, [applyLoaded, notify, t]);

  useEffect(() => {
    if (props.isOpen) {
      void load();
    }
  }, [props.isOpen, load]);

  function handleAddProfile(): void {
    if (llmProfiles.length >= MAX_LLM_PROFILES) {
      notify(t("settings:connection.maxProfiles", { max: MAX_LLM_PROFILES }), "info");
      return;
    }
    setLlmProfiles((current) => [...current, createEmptyProfile()]);
  }

  function handleDeleteProfile(profileId: string): void {
    if (llmProfiles.length <= 1) {
      return;
    }
    const nextProfiles = llmProfiles.filter((profile) => profile.id !== profileId);
    const fallbackId = nextProfiles[0].id;
    setLlmProfiles(nextProfiles);
    setLlmAssignments((current) => fallbackAssignments(current, profileId, fallbackId));
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await Promise.all([
        updateLlmSettings({ profiles: llmProfiles, assignments: llmAssignments }),
        updatePreferences(preferences),
        updateWritingStyle({ text: writingStyle }),
        updateDataSave(dataSave),
        updateTypography(typography),
      ]);
      applyTypography(typography);
      notify(t("settings:saved"), "success");
      props.onClose();
    } catch {
      notify(t("settings:saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportConfig(): Promise<void> {
    try {
      const config = await exportSettings();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      triggerDownload(blob, `auto-writer-settings-${Date.now()}.json`);
    } catch {
      notify(t("settings:config.exportFailed"), "error");
    }
  }

  async function handleImportConfig(file: File): Promise<void> {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppSettings> & {
        connection?: ConnectionSettings;
      };
      const applied = await importSettings(parsed);
      applyLoaded(applied);
      applyTypography(applied.typography);
      setLocale(applied.locale.locale);
      notify(t("settings:config.importSuccess"), "success");
    } catch {
      notify(t("settings:config.importFailed"), "error");
    }
  }

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      size="4xl"
      scrollBehavior="inside"
      classNames={{ base: "settings-modal" }}
    >
      <ModalContent>
        <ModalHeader>{t("settings:title")}</ModalHeader>
        <ModalBody>
          <Tabs aria-label={t("settings:title")} className="settings-modal-tabs">
            <Tab key="connection" title={t("settings:tabs.connection")}>
              <div className="settings-section">
                <Accordion
                  selectionMode="multiple"
                  className="llm-profile-accordion"
                  defaultExpandedKeys={
                    llmProfiles[0]?.id ? [llmProfiles[0].id] : []
                  }
                >
                  {llmProfiles.map((profile, index) => (
                    <AccordionItem
                      key={profile.id}
                      aria-label={profileLabel(profile, index)}
                      className="llm-profile-accordion-item"
                      title={
                        <div className="llm-profile-accordion-title">
                          <span>{profileLabel(profile, index)}</span>
                          {llmProfiles.length > 1 && (
                            <div
                              className="llm-profile-delete-wrap"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                color="danger"
                                variant="light"
                                startContent={<Trash2 size={15} />}
                                onPress={() => handleDeleteProfile(profile.id)}
                              >
                                {t("settings:connection.delete")}
                              </Button>
                            </div>
                          )}
                        </div>
                      }
                    >
                      <LLMProfileFields
                        profile={profile}
                        onChange={(next) =>
                          setLlmProfiles((current) =>
                            current.map((item) => (item.id === next.id ? next : item)),
                          )
                        }
                      />
                    </AccordionItem>
                  ))}
                </Accordion>
                <Button
                  variant="flat"
                  startContent={<Plus size={16} />}
                  isDisabled={llmProfiles.length >= MAX_LLM_PROFILES}
                  onPress={handleAddProfile}
                >
                  {t("settings:connection.addProfile")}
                </Button>
              </div>
            </Tab>

            <Tab key="llm_assignments" title={t("settings:tabs.llm_assignments")}>
              <LLMAssignmentPanel
                profiles={llmProfiles}
                assignments={llmAssignments}
                onChange={setLlmAssignments}
              />
            </Tab>

            <Tab key="preferences" title={t("settings:tabs.preferences")}>
              <div className="settings-section">
                <StagePreferenceEditor
                  title={t("settings:preferences.stages.outline")}
                  value={preferences.outline}
                  onChange={(outline) => setPreferences((p) => ({ ...p, outline }))}
                />
                <StagePreferenceEditor
                  title={t("settings:preferences.stages.writing")}
                  value={preferences.writing}
                  onChange={(writing) => setPreferences((p) => ({ ...p, writing }))}
                />
                <StagePreferenceEditor
                  title={t("settings:preferences.stages.review")}
                  value={preferences.review}
                  onChange={(review) => setPreferences((p) => ({ ...p, review }))}
                />
              </div>
            </Tab>

            <Tab key="writing_style" title={t("settings:tabs.writing_style")}>
              <div className="settings-section">
                <Textarea
                  label={t("settings:writingStyle.label")}
                  description={t("settings:writingStyle.description")}
                  minRows={6}
                  value={writingStyle}
                  onValueChange={setWritingStyle}
                />
              </div>
            </Tab>

            <Tab key="data_save" title={t("settings:tabs.data_save")}>
              <div className="settings-section">
                <Input
                  type="number"
                  label={t("settings:dataSave.inputDebounce")}
                  min={1}
                  max={10}
                  value={String(dataSave.input_debounce_seconds)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, input_debounce_seconds: Number(v) || 1 }))
                  }
                />
                <Input
                  type="number"
                  label={t("settings:dataSave.autosaveInterval")}
                  min={10}
                  max={120}
                  value={String(dataSave.autosave_interval_seconds)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, autosave_interval_seconds: Number(v) || 10 }))
                  }
                />
                <Input
                  label={t("settings:dataSave.snapshotPath")}
                  description={t("settings:dataSave.snapshotPathDescription")}
                  value={dataSave.snapshot_path}
                  onValueChange={(snapshot_path) => setDataSave((d) => ({ ...d, snapshot_path }))}
                />
                <Input
                  type="number"
                  label={t("settings:dataSave.historyVersions")}
                  min={0}
                  max={10}
                  value={String(dataSave.history_versions)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, history_versions: Number(v) || 0 }))
                  }
                />
              </div>
            </Tab>

            <Tab key="typography" title={t("settings:tabs.typography")}>
              <div className="settings-section">
                <Input
                  label={t("settings:typography.fontFamily")}
                  placeholder={t("settings:typography.fontFamilyPlaceholder")}
                  value={typography.font_family}
                  onValueChange={(font_family) => setTypography((t) => ({ ...t, font_family }))}
                />
                <Input
                  type="number"
                  label={t("settings:typography.lineHeight")}
                  min={1}
                  max={3}
                  step={0.1}
                  value={String(typography.line_height)}
                  onValueChange={(v) =>
                    setTypography((t) => ({ ...t, line_height: Number(v) || 1.8 }))
                  }
                />
                <Select
                  label={t("settings:typography.readingTheme")}
                  selectedKeys={[typography.reading_theme]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ReadingTheme;
                    if (value) {
                      setTypography((t) => ({ ...t, reading_theme: value }));
                    }
                  }}
                >
                  {READING_THEME_KEYS.map((theme) => (
                    <SelectItem key={theme}>{t(`settings:typography.themes.${theme}`)}</SelectItem>
                  ))}
                </Select>
              </div>
            </Tab>

            <Tab key="config" title={t("settings:tabs.config")}>
              <div className="settings-section">
                <p className="settings-hint">{t("settings:config.hint")}</p>
                <div className="test-row">
                  <Button
                    variant="flat"
                    startContent={<Download size={16} />}
                    onPress={() => void handleExportConfig()}
                  >
                    {t("settings:config.export")}
                  </Button>
                  <Button
                    variant="flat"
                    startContent={<Upload size={16} />}
                    onPress={() => importInputRef.current?.click()}
                  >
                    {t("settings:config.import")}
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleImportConfig(file);
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={props.onClose}>
            {t("common:cancel")}
          </Button>
          <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
            {t("common:save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
