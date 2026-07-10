/** Chapter outline: filterable, searchable, draggable chapter cards (§2.2). */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Tooltip,
} from "@heroui/react";
import { GripVertical, Plus, Search, Trash2 } from "lucide-react";
import type { Chapter, ChapterOrderItem, WorkStage } from "../../api";
import {
  chapterStatusLabelKey,
  isChapterCompleted,
} from "../../utils/chapterStatus";
import { translatePresetStageName } from "../../utils/storyStructureI18n";

const UNASSIGNED_KEY = "none";

interface ChapterOutlineProps {
  chapters: Chapter[];
  stages: WorkStage[];
  structureName: string | null | undefined;
  colorMap: Map<number, string>;
  selectedChapterId: number | null;
  onSelectChapter: (id: number) => void;
  onReorder: (items: ChapterOrderItem[]) => void;
  onAddChapter: () => void;
  onDeleteChapter: (chapter: Chapter) => void;
}

/** Render the chapter outline column with its toolbar and cards. */
export function ChapterOutline(props: ChapterOutlineProps): ReactElement {
  const { t } = useTranslation(["outline", "works"]);
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const canReorder = stageFilter.size === 0 && search.trim() === "";
  const filterKeys = [UNASSIGNED_KEY, ...props.stages.map((stage) => String(stage.id))];
  const allSelected = stageFilter.size === filterKeys.length;

  const visible = props.chapters.filter((chapter) => {
    const stageKey = chapter.stage_id == null ? UNASSIGNED_KEY : String(chapter.stage_id);
    if (stageFilter.size > 0 && !stageFilter.has(stageKey)) {
      return false;
    }
    if (search.trim() && !(chapter.title ?? "").toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  function handleDrop(targetId: number): void {
    setDragOverId(null);
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    const order = props.chapters.map((chapter) => chapter.id);
    const from = order.indexOf(draggingId);
    order.splice(from, 1);
    order.splice(order.indexOf(targetId), 0, draggingId);
    const byId = new Map(props.chapters.map((chapter) => [chapter.id, chapter]));
    props.onReorder(
      order.map((id) => ({ id, stage_id: byId.get(id)?.stage_id ?? null })),
    );
    setDraggingId(null);
  }

  function toggleSelectAll(): void {
    setStageFilter(allSelected ? new Set() : new Set(filterKeys));
  }

  return (
    <div className="chapter-outline">
      <div className="chapter-toolbar">
        <Select
          aria-label={t("outline:chapters.filterAria")}
          className="stage-filter"
          selectionMode="multiple"
          placeholder={t("outline:chapters.allStages")}
          selectedKeys={stageFilter}
          onSelectionChange={(keys) => setStageFilter(new Set(keys as Set<string>))}
        >
          {[
            <SelectItem key={UNASSIGNED_KEY}>{t("outline:chapters.unassigned")}</SelectItem>,
            ...props.stages.map((stage) => (
              <SelectItem key={String(stage.id)}>
                {translatePresetStageName(props.structureName, stage.name, t)}
              </SelectItem>
            )),
          ]}
        </Select>
        <Button variant="flat" onPress={toggleSelectAll}>
          {allSelected ? t("outline:chapters.deselectAll") : t("outline:chapters.selectAll")}
        </Button>
        <Input
          className="chapter-search"
          placeholder={t("outline:chapters.searchPlaceholder")}
          startContent={<Search size={16} />}
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
        />
        <Button color="primary" startContent={<Plus size={16} />} onPress={props.onAddChapter}>
          {t("outline:chapters.add")}
        </Button>
      </div>

      {!canReorder && <p className="chapter-hint">{t("outline:chapters.reorderHint")}</p>}

      <div className="chapter-list">
        {visible.length === 0 && <p className="chapter-empty">{t("outline:chapters.empty")}</p>}
        {visible.map((chapter) => {
          const color = chapter.stage_id != null ? props.colorMap.get(chapter.stage_id) : undefined;
          const statusKey = chapterStatusLabelKey(chapter.status);
          const statusLabel = statusKey.startsWith("outline:")
            ? t(statusKey)
            : chapter.status;
          return (
            <div
              key={chapter.id}
              className={[
                "chapter-card",
                canReorder ? "draggable" : "",
                props.selectedChapterId === chapter.id ? "selected" : "",
                draggingId === chapter.id ? "dragging" : "",
                dragOverId === chapter.id && draggingId !== chapter.id ? "drag-over" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={canReorder}
              onDragStart={() => setDraggingId(chapter.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragOverId !== chapter.id) {
                  setDragOverId(chapter.id);
                }
              }}
              onDragLeave={() => setDragOverId((current) => (current === chapter.id ? null : current))}
              onDrop={() => handleDrop(chapter.id)}
              onClick={() => props.onSelectChapter(chapter.id)}
              role="button"
              tabIndex={0}
            >
              {canReorder && (
                <span className="chapter-grip" aria-hidden>
                  <GripVertical size={16} />
                </span>
              )}
              <span className="chapter-color" style={{ background: color ?? "#94a3b8" }} />
              <div className="chapter-body">
                <div className="chapter-head">
                  <strong>
                    {t("outline:chapters.chapterLabel", { number: chapter.chapter_number })}
                    {chapter.title ? ` · ${chapter.title}` : ""}
                  </strong>
                  <div className="chapter-badges">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={isChapterCompleted(chapter.status) ? "success" : "default"}
                    >
                      {statusLabel}
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {t("outline:chapters.wordCount", { count: chapter.word_count })}
                    </Chip>
                    <Tooltip content={t("outline:chapters.deleteTooltip")} color="danger">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label={t("outline:chapters.deleteAria")}
                        onPress={() => props.onDeleteChapter(chapter)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <p className="chapter-summary">
                  {chapter.summary || t("outline:chapters.noSummary")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
