/** System settings modal: connection, global preferences, and writing style.
 *
 * Covers the Phase 2 tabs of ``SYSTEM_SETTINGS_PAGE_DESIGN.md`` (§3–5). The
 * data-save and typography tabs are added in a later phase.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
  Textarea,
} from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import {
  getSettings,
  testConnection,
  updateConnection,
  updatePreferences,
  updateWritingStyle,
  type ConnectionSettings,
  type ConnectionTestResult,
  type Preferences,
} from "../api";
import { DEFAULT_STAGE_PREFERENCE } from "../utils/preferences";
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

/** Render the system settings modal with editable connection/preferences/style. */
export function SettingsModal(props: SettingsModalProps): ReactElement {
  const { notify } = useToast();
  const [connection, setConnection] = useState<ConnectionSettings>(EMPTY_CONNECTION);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [writingStyle, setWritingStyle] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getSettings();
      setConnection(data.connection);
      setPreferences(data.preferences);
      setWritingStyle(data.writing_style.text);
      setTestResult(null);
    } catch {
      notify("无法加载系统设置", "error");
    }
  }, [notify]);

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
      ]);
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
