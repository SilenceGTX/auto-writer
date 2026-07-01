/** Chapter outline: filterable, searchable, draggable chapter cards (§2.2). */
import { useState, type ReactElement } from "react";
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

const UNASSIGNED_KEY = "none";

interface ChapterOutlineProps {
  chapters: Chapter[];
  stages: WorkStage[];
  colorMap: Map<number, string>;
  selectedChapterId: number | null;
  onSelectChapter: (id: number) => void;
  onReorder: (items: ChapterOrderItem[]) => void;
  onAddChapter: () => void;
  onDeleteChapter: (chapter: Chapter) => void;
}

/** Render the chapter outline column with its toolbar and cards. */
export function ChapterOutline(props: ChapterOutlineProps): ReactElement {
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
          aria-label="按阶段筛选"
          className="stage-filter"
          selectionMode="multiple"
          placeholder="全部阶段"
          selectedKeys={stageFilter}
          onSelectionChange={(keys) => setStageFilter(new Set(keys as Set<string>))}
        >
          {[
            <SelectItem key={UNASSIGNED_KEY}>未分配</SelectItem>,
            ...props.stages.map((stage) => (
              <SelectItem key={String(stage.id)}>{stage.name}</SelectItem>
            )),
          ]}
        </Select>
        <Button variant="flat" onPress={toggleSelectAll}>
          {allSelected ? "全不选" : "全选"}
        </Button>
        <Input
          className="chapter-search"
          placeholder="搜索章节标题"
          startContent={<Search size={16} />}
          value={search}
          onValueChange={setSearch}
          isClearable
          onClear={() => setSearch("")}
        />
        <Button color="primary" startContent={<Plus size={16} />} onPress={props.onAddChapter}>
          添加章节
        </Button>
      </div>

      {!canReorder && (
        <p className="chapter-hint">筛选或搜索时不可拖拽排序，清除后可恢复。</p>
      )}

      <div className="chapter-list">
        {visible.length === 0 && <p className="chapter-empty">没有符合条件的章节。</p>}
        {visible.map((chapter) => {
          const color = chapter.stage_id != null ? props.colorMap.get(chapter.stage_id) : undefined;
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
                    第 {chapter.chapter_number} 章
                    {chapter.title ? ` · ${chapter.title}` : ""}
                  </strong>
                  <div className="chapter-badges">
                    <Chip size="sm" variant="flat" color={chapter.status === "已完成" ? "success" : "default"}>
                      {chapter.status}
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {chapter.word_count} 字
                    </Chip>
                    <Tooltip content="删除" color="danger">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label="删除章节"
                        onPress={() => props.onDeleteChapter(chapter)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <p className="chapter-summary">{chapter.summary || "（尚无章节概述）"}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
