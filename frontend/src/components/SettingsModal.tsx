/** System settings modal: LLM profiles, assignments, preferences, and more.
 *
 * Covers all tabs of ``SYSTEM_SETTINGS_PAGE_DESIGN.md`` (§3–8).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
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

const READING_THEMES: { key: ReadingTheme; label: string }[] = [
  { key: "sepia", label: "护眼（米黄）" },
  { key: "light", label: "浅色" },
  { key: "dark", label: "深色" },
];

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
  const { notify } = useToast();
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
      notify("无法加载系统设置", "error");
    }
  }, [applyLoaded, notify]);

  useEffect(() => {
    if (props.isOpen) {
      void load();
    }
  }, [props.isOpen, load]);

  function handleAddProfile(): void {
    if (llmProfiles.length >= MAX_LLM_PROFILES) {
      notify(`最多添加 ${MAX_LLM_PROFILES} 个模型`, "info");
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
      notify("设置已保存", "success");
      props.onClose();
    } catch {
      notify("保存设置失败", "error");
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
      notify("导出配置失败", "error");
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
      notify("配置导入成功", "success");
    } catch {
      notify("配置文件无效或导入失败", "error");
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
        <ModalHeader>系统设置</ModalHeader>
        <ModalBody>
          <Tabs aria-label="系统设置标签" className="settings-modal-tabs">
            <Tab key="connection" title="连接配置">
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
                                删除
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
                  新增模型
                </Button>
              </div>
            </Tab>

            <Tab key="llm_assignments" title="LLM 分工">
              <LLMAssignmentPanel
                profiles={llmProfiles}
                assignments={llmAssignments}
                onChange={setLlmAssignments}
              />
            </Tab>

            <Tab key="preferences" title="全局偏好">
              <div className="settings-section">
                <StagePreferenceEditor
                  title="大纲"
                  value={preferences.outline}
                  onChange={(outline) => setPreferences((p) => ({ ...p, outline }))}
                />
                <StagePreferenceEditor
                  title="写作"
                  value={preferences.writing}
                  onChange={(writing) => setPreferences((p) => ({ ...p, writing }))}
                />
                <StagePreferenceEditor
                  title="审阅"
                  value={preferences.review}
                  onChange={(review) => setPreferences((p) => ({ ...p, review }))}
                />
              </div>
            </Tab>

            <Tab key="writing_style" title="写作风格">
              <div className="settings-section">
                <Textarea
                  label="写作风格"
                  description="将作为默认值注入 system prompt，用于统一行文风格。"
                  minRows={6}
                  value={writingStyle}
                  onValueChange={setWritingStyle}
                />
              </div>
            </Tab>

            <Tab key="data_save" title="数据保存">
              <div className="settings-section">
                <Input
                  type="number"
                  label="停止输入后保存延迟（秒）"
                  min={1}
                  max={10}
                  value={String(dataSave.input_debounce_seconds)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, input_debounce_seconds: Number(v) || 1 }))
                  }
                />
                <Input
                  type="number"
                  label="定时自动保存间隔（秒）"
                  min={10}
                  max={120}
                  value={String(dataSave.autosave_interval_seconds)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, autosave_interval_seconds: Number(v) || 10 }))
                  }
                />
                <Input
                  label="持久化文件存储路径"
                  description="后端 snapshot 持久化位置，相对路径基于数据目录。"
                  value={dataSave.snapshot_path}
                  onValueChange={(snapshot_path) => setDataSave((d) => ({ ...d, snapshot_path }))}
                />
                <Input
                  type="number"
                  label="历史版本数量"
                  min={0}
                  max={10}
                  value={String(dataSave.history_versions)}
                  onValueChange={(v) =>
                    setDataSave((d) => ({ ...d, history_versions: Number(v) || 0 }))
                  }
                />
              </div>
            </Tab>

            <Tab key="typography" title="字体与排版">
              <div className="settings-section">
                <Input
                  label="字体"
                  placeholder="留空使用系统默认，如 Noto Serif SC"
                  value={typography.font_family}
                  onValueChange={(font_family) => setTypography((t) => ({ ...t, font_family }))}
                />
                <Input
                  type="number"
                  label="行间距"
                  min={1}
                  max={3}
                  step={0.1}
                  value={String(typography.line_height)}
                  onValueChange={(v) =>
                    setTypography((t) => ({ ...t, line_height: Number(v) || 1.8 }))
                  }
                />
                <Select
                  label="正文护眼色"
                  selectedKeys={[typography.reading_theme]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as ReadingTheme;
                    if (value) {
                      setTypography((t) => ({ ...t, reading_theme: value }));
                    }
                  }}
                >
                  {READING_THEMES.map((theme) => (
                    <SelectItem key={theme.key}>{theme.label}</SelectItem>
                  ))}
                </Select>
              </div>
            </Tab>

            <Tab key="config" title="配置导入/导出">
              <div className="settings-section">
                <p className="settings-hint">
                  将全部系统设置导出为配置文件用于备份或迁移；导入时会校验并覆盖对应分组。
                </p>
                <div className="test-row">
                  <Button
                    variant="flat"
                    startContent={<Download size={16} />}
                    onPress={() => void handleExportConfig()}
                  >
                    导出配置
                  </Button>
                  <Button
                    variant="flat"
                    startContent={<Upload size={16} />}
                    onPress={() => importInputRef.current?.click()}
                  >
                    导入配置
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
            取消
          </Button>
          <Button color="primary" isLoading={saving} onPress={() => void handleSave()}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
