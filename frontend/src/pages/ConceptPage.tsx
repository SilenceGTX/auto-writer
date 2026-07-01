/** Worldbuilding (设定) page: category tabs, entry cards, and an editor panel.
 *
 * Implements ``designs/CONCEPT_PAGE_DESIGN.md``: manage per-work entity
 * categories (preset + custom) and their entries (search / sort / paginate /
 * copy), with a contextual create/edit form in the assistant panel.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Button, Input, Pagination, Select, SelectItem, Tooltip } from "@heroui/react";
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Plus, Search } from "lucide-react";
import {
  createEntity,
  deleteCategory,
  deleteEntity,
  listCategories,
  listEntities,
  type EntityCategory,
  type WorldEntity,
} from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CategoryTabs } from "./worldbuilding/CategoryTabs";
import { EntityCard } from "./worldbuilding/EntityCard";
import { EntityForm } from "./worldbuilding/EntityForm";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { key: "sort_order", label: "默认顺序" },
  { key: "name", label: "名称" },
  { key: "created_at", label: "创建时间" },
];

type PanelState = { mode: "none" } | { mode: "create" } | { mode: "edit"; entity: WorldEntity };

/** Render the worldbuilding management page for the current work. */
export function ConceptPage(): ReactElement {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { currentWorkId } = useApp();
  const { slot, setPageOwnsPanel, setCollapsed } = useAssistant();

  const [categories, setCategories] = useState<EntityCategory[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("sort_order");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [panel, setPanel] = useState<PanelState>({ mode: "none" });
  const [pendingDeleteEntity, setPendingDeleteEntity] = useState<WorldEntity | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<EntityCategory | null>(null);

  const openPanel = useCallback(
    (next: PanelState) => {
      setCollapsed(false);
      setPanel(next);
    },
    [setCollapsed],
  );

  useEffect(() => {
    setPageOwnsPanel(true);
    return () => setPageOwnsPanel(false);
  }, [setPageOwnsPanel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCategories = useCallback(async () => {
    if (currentWorkId == null) return;
    try {
      const data = await listCategories(currentWorkId);
      setCategories(data);
      setActiveId((current) =>
        current != null && data.some((category) => category.id === current)
          ? current
          : (data[0]?.id ?? null),
      );
    } catch {
      notify("无法加载设定种类", "error");
    }
  }, [currentWorkId, notify]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadEntities = useCallback(async () => {
    if (currentWorkId == null || activeId == null) {
      setEntities([]);
      setTotal(0);
      return;
    }
    try {
      const data = await listEntities(currentWorkId, {
        categoryId: activeId,
        search,
        sortBy,
        order,
        page,
        pageSize: PAGE_SIZE,
      });
      setEntities(data.items);
      setTotal(data.total);
    } catch {
      notify("无法加载设定条目", "error");
    }
  }, [currentWorkId, activeId, search, sortBy, order, page, notify]);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  function selectCategory(categoryId: number): void {
    setActiveId(categoryId);
    setPage(1);
    setPanel({ mode: "none" });
  }

  async function handleEntitySaved(): Promise<void> {
    setPanel({ mode: "none" });
    await Promise.all([loadEntities(), loadCategories()]);
  }

  async function handleCopy(entity: WorldEntity): Promise<void> {
    if (currentWorkId == null) return;
    try {
      const created = await createEntity(currentWorkId, {
        category_id: entity.category_id,
        name: `${entity.name} 副本`,
        description: entity.description,
        properties: entity.properties,
      });
      await Promise.all([loadEntities(), loadCategories()]);
      openPanel({ mode: "edit", entity: created });
      notify("已复制条目", "success");
    } catch {
      notify("复制条目失败", "error");
    }
  }

  async function handleConfirmDeleteEntity(): Promise<void> {
    if (!pendingDeleteEntity) return;
    try {
      await deleteEntity(pendingDeleteEntity.id);
      if (panel.mode === "edit" && panel.entity.id === pendingDeleteEntity.id) {
        setPanel({ mode: "none" });
      }
      await Promise.all([loadEntities(), loadCategories()]);
      notify("条目已删除", "success");
    } catch {
      notify("删除条目失败", "error");
    } finally {
      setPendingDeleteEntity(null);
    }
  }

  async function handleConfirmDeleteCategory(): Promise<void> {
    if (!pendingDeleteCategory) return;
    try {
      await deleteCategory(pendingDeleteCategory.id);
      if (activeId === pendingDeleteCategory.id) {
        setActiveId(null);
      }
      setPanel({ mode: "none" });
      await loadCategories();
      notify("种类已删除", "success");
    } catch {
      notify("删除种类失败", "error");
    } finally {
      setPendingDeleteCategory(null);
    }
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>设定</h1>
          <p>请先在作品页选择一个作品，再来管理世界观设定。</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            前往作品页
          </Button>
        </div>
      </section>
    );
  }

  const activeCategory = categories.find((category) => category.id === activeId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const assistantContent =
    panel.mode === "create" && activeId != null ? (
      <EntityForm
        key="create"
        workId={currentWorkId}
        categories={categories}
        defaultCategoryId={activeId}
        entity={null}
        onSaved={() => void handleEntitySaved()}
        onCancel={() => setPanel({ mode: "none" })}
      />
    ) : panel.mode === "edit" ? (
      <EntityForm
        key={`edit-${panel.entity.id}`}
        workId={currentWorkId}
        categories={categories}
        defaultCategoryId={panel.entity.category_id}
        entity={panel.entity}
        onSaved={() => void handleEntitySaved()}
        onCancel={() => setPanel({ mode: "none" })}
      />
    ) : null;

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>设定</h1>
          <p>维护角色、地点、物品与概念，写作时可通过 @ 引用它们。</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          isDisabled={activeId == null}
          onPress={() => openPanel({ mode: "create" })}
        >
          新建条目
        </Button>
      </div>

      <CategoryTabs
        workId={currentWorkId}
        categories={categories}
        activeId={activeId}
        onSelect={selectCategory}
        onCreated={(category) => {
          setCategories((current) => [...current, category]);
          selectCategory(category.id);
        }}
        onRequestDelete={(category) => setPendingDeleteCategory(category)}
      />

      <div className="entity-toolbar">
        <Input
          className="entity-search"
          placeholder="搜索条目名称或描述"
          startContent={<Search size={16} />}
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput("")}
        />
        <Select
          aria-label="排序方式"
          className="entity-sort"
          selectedKeys={[sortBy]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0] as string | undefined;
            if (key) {
              setSortBy(key);
              setPage(1);
            }
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.key}>{option.label}</SelectItem>
          ))}
        </Select>
        <Tooltip content={order === "asc" ? "正序（点击切换倒序）" : "倒序（点击切换正序）"}>
          <Button
            isIconOnly
            variant="flat"
            aria-label={order === "asc" ? "切换为倒序" : "切换为正序"}
            onPress={() => {
              setOrder((current) => (current === "asc" ? "desc" : "asc"));
              setPage(1);
            }}
          >
            {order === "asc" ? (
              <ArrowUpNarrowWide size={18} />
            ) : (
              <ArrowDownNarrowWide size={18} />
            )}
          </Button>
        </Tooltip>
      </div>

      {entities.length === 0 ? (
        <p className="entity-empty">
          {activeCategory ? `「${activeCategory.name}」下还没有条目。` : "请先选择一个种类。"}
          {activeId != null && " 点击右上角「新建条目」开始添加。"}
        </p>
      ) : (
        <div className="entity-grid">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              selected={panel.mode === "edit" && panel.entity.id === entity.id}
              onSelect={(item) => openPanel({ mode: "edit", entity: item })}
              onCopy={(item) => void handleCopy(item)}
              onDelete={(item) => setPendingDeleteEntity(item)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-row">
          <Pagination total={totalPages} page={page} onChange={setPage} showControls />
        </div>
      )}

      {slot && assistantContent && createPortal(assistantContent, slot)}

      <ConfirmDialog
        isOpen={pendingDeleteEntity !== null}
        title="删除条目"
        body={`确定要删除「${pendingDeleteEntity?.name ?? ""}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDeleteEntity()}
        onCancel={() => setPendingDeleteEntity(null)}
      />

      <ConfirmDialog
        isOpen={pendingDeleteCategory !== null}
        title="删除种类"
        body={`确定要删除种类「${pendingDeleteCategory?.name ?? ""}」吗？该种类下的所有条目都会被一并删除，且无法恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDeleteCategory()}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </section>
  );
}
