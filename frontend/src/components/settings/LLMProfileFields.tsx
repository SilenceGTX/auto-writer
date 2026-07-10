/** Form fields and connection test for one LLM profile. */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip, Input } from "@heroui/react";
import { Eye, EyeOff } from "lucide-react";
import type { ConnectionTestResult, LLMProfile } from "../../api";
import { testConnection } from "../../api";

interface LLMProfileFieldsProps {
  profile: LLMProfile;
  onChange: (next: LLMProfile) => void;
}

/** Render editable endpoint fields and a per-profile connection test. */
export function LLMProfileFields(props: LLMProfileFieldsProps): ReactElement {
  const { t } = useTranslation("settings");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  async function handleTest(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testConnection(props.profile));
    } catch {
      setTestResult({ ok: false, code: "request_failed", detail: null, sample: null });
    } finally {
      setTesting(false);
    }
  }

  function formatTestMessage(result: ConnectionTestResult): string {
    const key = `connection.testResults.${result.code}`;
    return result.detail ? t(key, { detail: result.detail }) : t(key);
  }

  return (
    <div className="llm-profile-card-body">
      <Input
        label={t("connection.urlLabel")}
        placeholder={t("connection.urlPlaceholder")}
        value={props.profile.url}
        onValueChange={(url) => props.onChange({ ...props.profile, url })}
      />
      <Input
        label={t("connection.tokenLabel")}
        type={showToken ? "text" : "password"}
        value={props.profile.api_token}
        onValueChange={(api_token) => props.onChange({ ...props.profile, api_token })}
        endContent={
          <button
            type="button"
            className="token-toggle"
            aria-label={showToken ? t("connection.hideToken") : t("connection.showToken")}
            onClick={() => setShowToken((value) => !value)}
          >
            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
      />
      <Input
        label={t("connection.modelLabel")}
        placeholder={t("connection.modelPlaceholder")}
        value={props.profile.model}
        onValueChange={(model) => props.onChange({ ...props.profile, model })}
      />
      <div className="test-row">
        <Button variant="flat" isLoading={testing} onPress={() => void handleTest()}>
          {t("connection.testConnection")}
        </Button>
        {testResult && (
          <Chip color={testResult.ok ? "success" : "danger"} variant="flat">
            {formatTestMessage(testResult)}
          </Chip>
        )}
      </div>
    </div>
  );
}
