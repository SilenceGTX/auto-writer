/** System settings modal: connection, preferences, writing style, data save,
 * typography, and one-click configuration import / export.
 *
 * Covers all tabs of ``SYSTEM_SETTINGS_PAGE_DESIGN.md`` (§3–8).
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { Download, Eye, EyeOff, Upload } from "lucide-react";
import {
  exportSettings,
  getSettings,
  importSettings,
  testConnection,
  triggerDownload,
  updateConnection,
  updateDataSave,
  updatePreferences,
  updateTypography,
  updateWritingStyle,
  type AppSettings,
  type ConnectionSettings,
  type ConnectionTestResult,
  type DataSaveSettings,
  type Preferences,
  type ReadingTheme,
  type TypographySettings,
} from "../api";
import { DEFAULT_STAGE_PREFERENCE } from "../utils/preferences";
import { applyTypography } from "../utils/typography";
import { useToast } from "./Toast";
import { StagePreferenceEditor } from "./settings/StagePreferenceEditor";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_CONNECTION: ConnectionSettings = { url: "", api_token: "", model: "" };
const DEFAULT_PREFERENCES: Preferences = {
  outline: { ...DEFAULT_STAGE_PREFERENCE },
  writing: { ...DEFAULT_STAGE_PREFERENCE },
};
const DEFAULT_DATA_SAVE: DataSaveSettings = {
  input_debounce_seconds: 2,
  autosave_interval_seconds: 30,
  snapshot_path: "data/snapshots",
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

/** Render the system settings modal with editable settings groups. */
export function SettingsModal(props: SettingsModalProps): ReactElement {
  const { notify } = useToast();
  const [connection, setConnection] = useState<ConnectionSettings>(EMPTY_CONNECTION);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [writingStyle, setWritingStyle] = useState("");
  const [dataSave, setDataSave] = useState<DataSaveSettings>(DEFAULT_DATA_SAVE);
  const [typography, setTypography] = useState<TypographySettings>(DEFAULT_TYPOGRAPHY);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const applyLoaded = useCallback((data: AppSettings) => {
    setConnection(data.connection);
    setPreferences(data.preferences);
    setWritingStyle(data.writing_style.text);
    setDataSave(data.data_save);
    setTypography(data.typography);
  }, []);

  const load = useCallback(async () => {
    try {
      applyLoaded(await getSettings());
      setTestResult(null);
    } catch {
      notify("无法加载系统设置", "error");
    }
  }, [applyLoaded, notify]);

  useEffect(() => {
    if (props.isOpen) {
      void load();
    }
  }, [props.isOpen, load]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      await Promise.all([
        updateConnection(connection),
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

  async function handleTest(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testConnection(connection));
    } catch {
      setTestResult({ ok: false, message: "测试请求失败", sample: null });
    } finally {
      setTesting(false);
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
      const parsed = JSON.parse(await file.text()) as Partial<AppSettings>;
      const applied = await importSettings(parsed);
      applyLoaded(applied);
      applyTypography(applied.typography);
      notify("配置导入成功", "success");
    } catch {
      notify("配置文件无效或导入失败", "error");
    }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>系统设置</ModalHeader>
        <ModalBody>
          <Tabs aria-label="系统设置标签">
            <Tab key="connection" title="连接配置">
              <div className="settings-section">
                <Input
                  label="URL"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={connection.url}
                  onValueChange={(url) => setConnection((c) => ({ ...c, url }))}
                />
                <Input
                  label="API Token"
                  type={showToken ? "text" : "password"}
                  value={connection.api_token}
                  onValueChange={(token) => setConnection((c) => ({ ...c, api_token: token }))}
                  endContent={
                    <button
                      type="button"
                      className="token-toggle"
                      aria-label={showToken ? "隐藏 Token" : "显示 Token"}
                      onClick={() => setShowToken((value) => !value)}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
                <Input
                  label="模型"
                  placeholder="如 gpt-4o-mini"
                  value={connection.model}
                  onValueChange={(model) => setConnection((c) => ({ ...c, model }))}
                />
                <div className="test-row">
                  <Button variant="flat" isLoading={testing} onPress={() => void handleTest()}>
                    测试连接
                  </Button>
                  {testResult && (
                    <Chip color={testResult.ok ? "success" : "danger"} variant="flat">
                      {testResult.message}
                    </Chip>
                  )}
                </div>
              </div>
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
