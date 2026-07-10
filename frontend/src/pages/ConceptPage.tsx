/** Worldbuilding (设定) page: category tabs, entry cards, and an editor panel.
 *
 * Implements ``designs/CONCEPT_PAGE_DESIGN.md``: manage per-work entity
 * categories (preset + custom) and their entries (search / sort / paginate /
 * copy), with a contextual create/edit form in the assistant panel.
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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
import { WorkTitleSelect } from "../components/WorkTitleSelect";
import { translateCategoryName } from "../utils/entityCategoryI18n";
import { CategoryTabs } from "./worldbuilding/CategoryTabs";
import { EntityCard } from "./worldbuilding/EntityCard";
import { EntityForm } from "./worldbuilding/EntityForm";

const PAGE_SIZE = 12;

const SORT_OPTION_KEYS = [
  { key: "sort_order", labelKey: "toolbar.sortDefault" },
  { key: "name", labelKey: "toolbar.sortName" },
  { key: "created_at", labelKey: "toolbar.sortCreatedAt" },
] as const;

type PanelState = { mode: "none" } | { mode: "create" } | { mode: "edit"; entity: WorldEntity };

/** Render the worldbuilding management page for the current work. */
export function ConceptPage(): ReactElement {
  const { t } = useTranslation(["concept", "common"]);
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
      notify(t("concept:toast.loadCategoriesFailed"), "error");
    }
  }, [currentWorkId, notify, t]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setPanel({ mode: "none" });
    setPage(1);
    setSearchInput("");
    setSearch("");
  }, [currentWorkId]);

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
      notify(t("concept:toast.loadEntitiesFailed"), "error");
    }
  }, [currentWorkId, activeId, search, sortBy, order, page, notify, t]);

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
        name: `${entity.name} ${t("concept:entity.copySuffix")}`,
        description: entity.description,
        properties: entity.properties,
      });
      await Promise.all([loadEntities(), loadCategories()]);
      openPanel({ mode: "edit", entity: created });
      notify(t("concept:toast.copied"), "success");
    } catch {
      notify(t("concept:toast.copyFailed"), "error");
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
      notify(t("concept:toast.entityDeleted"), "success");
    } catch {
      notify(t("concept:toast.entityDeleteFailed"), "error");
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
      notify(t("concept:toast.categoryDeleted"), "success");
    } catch {
      notify(t("concept:toast.categoryDeleteFailed"), "error");
    } finally {
      setPendingDeleteCategory(null);
    }
  }

  if (currentWorkId == null) {
    return (
      <section className="workspace-page">
        <div className="outline-empty">
          <h1>{t("concept:page.title")}</h1>
          <p>{t("concept:page.emptyWork.body")}</p>
          <Button color="primary" onPress={() => navigate("/works")}>
            {t("concept:page.emptyWork.goToWorks")}
          </Button>
        </div>
      </section>
    );
  }

  const activeCategory = categories.find((category) => category.id === activeId) ?? null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCategoryLabel = activeCategory ? translateCategoryName(activeCategory, t) : "";

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
          <WorkTitleSelect fallback={t("concept:page.fallbackTitle")} />
          <p>{t("concept:page.subtitle")}</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          isDisabled={activeId == null}
          onPress={() => openPanel({ mode: "create" })}
        >
          {t("concept:page.createEntity")}
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
          placeholder={t("concept:toolbar.searchPlaceholder")}
          startContent={<Search size={16} />}
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput("")}
        />
        <Select
          aria-label={t("concept:toolbar.sortAria")}
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
          {SORT_OPTION_KEYS.map((option) => (
            <SelectItem key={option.key}>{t(`concept:${option.labelKey}`)}</SelectItem>
          ))}
        </Select>
        <Tooltip
          content={
            order === "asc"
              ? t("concept:toolbar.orderAscTooltip")
              : t("concept:toolbar.orderDescTooltip")
          }
        >
          <Button
            isIconOnly
            variant="flat"
            aria-label={
              order === "asc"
                ? t("concept:toolbar.switchToDesc")
                : t("concept:toolbar.switchToAsc")
            }
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
          {activeCategory
            ? t("concept:entity.emptyInCategory", { category: activeCategoryLabel })
            : t("concept:entity.emptyNoCategory")}
          {activeId != null && t("concept:entity.emptyHint")}
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
        title={t("concept:deleteDialog.entityTitle")}
        body={t("concept:deleteDialog.entityBody", { name: pendingDeleteEntity?.name ?? "" })}
        confirmLabel={t("concept:deleteDialog.confirm")}
        cancelLabel={t("common:cancel")}
        danger
        onConfirm={() => void handleConfirmDeleteEntity()}
        onCancel={() => setPendingDeleteEntity(null)}
      />

      <ConfirmDialog
        isOpen={pendingDeleteCategory !== null}
        title={t("concept:deleteDialog.categoryTitle")}
        body={t("concept:deleteDialog.categoryBody", {
          name: pendingDeleteCategory ? translateCategoryName(pendingDeleteCategory, t) : "",
        })}
        confirmLabel={t("concept:deleteDialog.confirm")}
        cancelLabel={t("common:cancel")}
        danger
        onConfirm={() => void handleConfirmDeleteCategory()}
        onCancel={() => setPendingDeleteCategory(null)}
      />
    </section>
  );
}
