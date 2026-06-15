/** Writing page — the main editor for composing with LLM assistance. */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

function WritePage() {
  const [searchParams] = useSearchParams();
  const storyId = searchParams.get("story");
  const [content, setContent] = useState("");

  return (
    <div className="write-page">
      <h1>写作 {storyId && `— 作品 #${storyId}`}</h1>
      <textarea
        className="editor"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="在此开始创作..."
      />
      <div className="toolbar">
        <button>AI 续写</button>
        <button>AI 润色</button>
        <button>保存</button>
      </div>
    </div>
  );
}

export default WritePage;
