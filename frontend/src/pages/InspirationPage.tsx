/** Inspiration (灵感) page: a global clipboard of captured snippets.
 *
 * Implements ``designs/INSIGHTS_PAGE_DESIGN.md``: a searchable / filterable card
 * list of inspirations captured from other pages (G3 加入灵感), with a detail
 * modal offering copy, "一键回插" (insert back into the writing editor), source
 * jumping, and colored-tag classification. This page has no assistant panel.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
import { INSPIRATION_CREATED_EVENT } from "../utils/events";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { InspirationCard } from "./inspiration/InspirationCard";
import { InspirationDetailModal } from "./inspiration/InspirationDetailModal";

const SOURCE_FILTER_KEYS = ["all", "outline", "writing", "review"] as const;

const DEFAULT_TAG_COLOR = "#4f46e5";

/** Render the inspiration management page. */
export function InspirationPage(): ReactElement {
  const { t } = useTranslation("inspiration");
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
      notify(t("toast.loadTagsFailed"), "error");
    }
  }, [notify, t]);

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
      notify(t("toast.loadFailed"), "error");
    }
  }, [search, sourceFilter, tagFilter, notify, t]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    void loadInspirations();
  }, [loadInspirations]);

  useEffect(() => {
    const handler = (): void => void loadInspirations();
    window.addEventListener(INSPIRATION_CREATED_EVENT, handler);
    return () => window.removeEventListener(INSPIRATION_CREATED_EVENT, handler);
  }, [loadInspirations]);

  async function handleCopy(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      notify(t("toast.copied"), "success");
    } catch {
      notify(t("toast.copyFailed"), "error");
    }
  }

  function handleInsertBack(inspiration: Inspiration): void {
    if (inspiration.work_id == null && currentWorkId == null) {
      notify(t("toast.selectWorkForInsert"), "info");
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
      notify(t("toast.updateTagsFailed"), "error");
    }
  }

  async function handleCreateTag(inspiration: Inspiration, name: string): Promise<void> {
    try {
      const tag = await createTag(name, DEFAULT_TAG_COLOR);
      await loadTags();
      const nextIds = Array.from(new Set([...inspiration.tags.map((t) => t.id), tag.id]));
      await handleSetTags(inspiration, nextIds);
    } catch {
      notify(t("toast.createTagFailed"), "error");
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
      notify(t("toast.deleted"), "success");
    } catch {
      notify(t("toast.deleteFailed"), "error");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <section className="workspace-page inspiration-page">
      <div className="page-header">
        <div>
          <h1>{t("page.title")}</h1>
          <p>{t("page.subtitle")}</p>
        </div>
      </div>

      <div className="inspiration-toolbar">
        <Input
          className="inspiration-search"
          placeholder={t("toolbar.searchPlaceholder")}
          startContent={<Search size={16} />}
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput("")}
        />
        <Select
          aria-label={t("toolbar.sourceFilterAria")}
          className="inspiration-filter"
          selectedKeys={[sourceFilter]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setSourceFilter(key);
          }}
        >
          {SOURCE_FILTER_KEYS.map((key) => (
            <SelectItem key={key}>
              {key === "all" ? t("toolbar.allSources") : t(`sources.${key}`)}
            </SelectItem>
          ))}
        </Select>
        <Select
          aria-label={t("toolbar.tagFilterAria")}
          className="inspiration-filter"
          selectedKeys={[tagFilter]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) setTagFilter(key);
          }}
        >
          {[
            <SelectItem key="all">{t("toolbar.allTags")}</SelectItem>,
            ...tags.map((tag) => <SelectItem key={String(tag.id)}>{tag.name}</SelectItem>),
          ]}
        </Select>
      </div>

      {inspirations.length === 0 ? (
        <p className="entity-empty">{t("page.empty")}</p>
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
        title={t("deleteDialog.title")}
        body={t("deleteDialog.body")}
        confirmLabel={t("deleteDialog.confirm")}
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
