/** Form fields and connection test for one LLM profile. */
import { useState, type ReactElement } from "react";
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
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  async function handleTest(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testConnection(props.profile));
    } catch {
      setTestResult({ ok: false, message: "测试请求失败", sample: null });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="llm-profile-card-body">
      <Input
        label="URL"
        placeholder="https://api.example.com/v1/chat/completions"
        value={props.profile.url}
        onValueChange={(url) => props.onChange({ ...props.profile, url })}
      />
      <Input
        label="API Token"
        type={showToken ? "text" : "password"}
        value={props.profile.api_token}
        onValueChange={(api_token) => props.onChange({ ...props.profile, api_token })}
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
        value={props.profile.model}
        onValueChange={(model) => props.onChange({ ...props.profile, model })}
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
  );
}
