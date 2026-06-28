/** Inspiration (灵感) page: a global clipboard of captured snippets.
 *
 * Implements ``designs/INSIGHTS_PAGE_DESIGN.md``: a searchable / filterable card
 * list of inspirations captured from other pages (G3 加入灵感), with a detail
 * modal offering copy, "一键回插" (insert back into the writing editor), source
 * jumping, and colored-tag classification. This page has no assistant panel.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Select, SelectItem } from "@heroui/react";
import { Search } from "lucide-react";
import {
  createTag,
  deleteInspiration,
  listInspirations,
  listTags,
  setInspirationTags,
  type Inspiration,
  type InspirationSourcePage,
  type Tag,
} from "../api";
import { useApp } from "../context/AppContext";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { InspirationCard } from "./inspiration/InspirationCard";
import { InspirationDetailModal } from "./inspiration/InspirationDetailModal";

const SOURCE_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "全部来源" },
  { key: "outline", label: "大纲" },
  { key: "writing", label: "写作" },
  { key: "review", label: "审阅" },
];

const DEFAULT_TAG_COLOR = "#4f46e5";

/** Render the inspiration management page. */
export function InspirationPage(): ReactElement {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId, setCurrentWorkId, setPendingInsert, setPendingHighlight } = useApp();

  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selected, setSelected] = useState<Inspiration | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Inspiration | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadTags = useCallback(async () => {
    try {
      setTags(await listTags());
    } catch {
      notify("无法加载标签", "error");
    }
  }, [notify]);

  const loadInspirations = useCallback(async () => {
    try {
      const data = await listInspirations({
        search,
        sourcePage:
          sourceFilter === "all" ? undefined : (sourceFilter as InspirationSourcePage),
        tagId: tagFilter === "all" ? undefined : Number(tagFilter),
      });
      setInspirations(data);
      setSelected((current) =>
        current ? (data.find((item) => item.id === current.id) ?? null) : null,
      );
    } catch {
      notify("无法加载灵感", "error");
    }
  }, [search, sourceFilter, tagFilter, notify]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    void loadInspirations();
  }, [loadInspirations]);

  async function handleCopy(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      notify("已复制到剪贴板", "success");
    } catch {
      notify("复制失败", "error");
    }
  }

  function handleInsertBack(inspiration: Inspiration): void {
    if (inspiration.work_id == null && currentWorkId == null) {
      notify("请先在作品页选择一个作品再回插", "info");
      return;
    }
    // "一键回插" always appends to the end of the current chapter's body so the
    // landing position is predictable; the writing editor then highlights it.
    setPendingInsert(inspiration.content);
    setPendingHighlight(null);
    if (inspiration.work_id != null) {
      setCurrentWorkId(inspiration.work_id);
    }
    const chapterQuery = inspiration.chapter_id != null ? `?chapter=${inspiration.chapter_id}` : "";
    navigate(`/writing${chapterQuery}`);
  }

  function handleJumpSource(inspiration: Inspiration): void {
    if (inspiration.work_id != null) {
      setCurrentWorkId(inspiration.work_id);
    }
    const chapterQuery = inspiration.chapter_id != null ? `?chapter=${inspiration.chapter_id}` : "";
    // Ask the target page to highlight the source text; it falls back to a plain
    // jump if the original passage no longer exists (content changed/deleted).
    if (inspiration.source_page === "writing") {
      setPendingHighlight(inspiration.content);
      navigate(`/writing${chapterQuery}`);
    } else if (inspiration.source_page === "review") {
      setPendingHighlight(inspiration.content);
      navigate(`/review${chapterQuery}`);
    } else if (inspiration.source_page === "outline") {
      setPendingHighlight(null);
      navigate("/outline");
    } else {
      setPendingHighlight(null);
      navigate("/works");
    }
  }

  async function handleSetTags(inspiration: Inspiration, tagIds: number[]): Promise<void> {
    try {
      const updated = await setInspirationTags(inspiration.id, tagIds);
      setInspirations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelected((current) => (current && current.id === updated.id ? updated : current));
    } catch {
      notify("更新标签失败", "error");
    }
  }

  async function handleCreateTag(inspiration: Inspiration, name: string): Promise<void> {
    try {
      const tag = await createTag(name, DEFAULT_TAG_COLOR);
      await loadTags();
      const nextIds = Array.from(new Set([...inspiration.tags.map((t) => t.id), tag.id]));
      await handleSetTags(inspiration, nextIds);
    } catch {
      notify("创建标签失败", "error");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteInspiration(pendingDelete.id);
      if (selected?.id === pendingDelete.id) {
        setSelected(null);
      }
      await loadInspirations();
      notify("灵感已删除", "success");
    } catch {
      notify("删除灵感失败", "error");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <section className="workspace-page inspiration-page">
      <div className="page-header">
        <div>
          <h1>灵感</h1>
          <p>收集创作中迸发的灵感碎片，随时检索、回插与归类。</p>
        </div>
      </div>

      <div className="inspiration-toolbar">
        <Input
          className="inspiration-search"
          placeholder="搜索灵感内容"
          startContent={<Search size={16} />}
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput("")}
        />
        <Select
          aria-label="按来源过滤"
          className="inspiration-filter"
          selectedKeys={[sourceFilter]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setSourceFilter(key);
          }}
        >
          {SOURCE_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Select
          aria-label="按标签过滤"
          className="inspiration-filter"
          selectedKeys={[tagFilter]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setTagFilter(key);
          }}
        >
          {[
            <SelectItem key="all">全部标签</SelectItem>,
            ...tags.map((tag) => <SelectItem key={String(tag.id)}>{tag.name}</SelectItem>),
          ]}
        </Select>
      </div>

      {inspirations.length === 0 ? (
        <p className="entity-empty">
          还没有灵感。在大纲、写作或审阅页选中文字后点击「加入灵感」即可收集到这里。
        </p>
      ) : (
        <div className="inspiration-grid">
          {inspirations.map((inspiration) => (
            <InspirationCard
              key={inspiration.id}
              inspiration={inspiration}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}

      {selected && (
        <InspirationDetailModal
          inspiration={selected}
          allTags={tags}
          onClose={() => setSelected(null)}
          onCopy={(content) => void handleCopy(content)}
          onInsertBack={handleInsertBack}
          onJumpSource={handleJumpSource}
          onDelete={(inspiration) => setPendingDelete(inspiration)}
          onSetTags={(inspiration, tagIds) => void handleSetTags(inspiration, tagIds)}
          onCreateTag={(name) => void handleCreateTag(selected, name)}
        />
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="删除灵感"
        body="确定要删除这条灵感吗？此操作不可恢复。"
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
