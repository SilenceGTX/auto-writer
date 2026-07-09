/** Works page: searchable, sortable, paginated works table with a contextual
 * assistant panel for creating and editing works (``STORY_PAGE_DESIGN.md``).
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
  type SortDescriptor,
} from "@heroui/react";
import { Download, FileText, PenLine, Plus, Search, SearchCheck, Sparkles, Trash2 } from "lucide-react";
import {
  deleteWork,
  downloadWorkExport,
  listSeries,
  listStructures,
  listWorks,
  updateWork,
  type Series,
  type StoryStructure,
  type Work,
} from "../api";
import { useApp } from "../context/AppContext";
import { useAssistant } from "../context/AssistantContext";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { computeProgress } from "../utils/workProgress";
import { WORK_STATUS_VALUES, workStatusColor, workStatusLabelKey } from "../utils/workStatus";
import { translatePresetStructureName } from "../utils/storyStructureI18n";
import { WorkCreateForm } from "./works/WorkCreateForm";
import { WorkDetailPanel } from "./works/WorkDetailPanel";

const PAGE_SIZE = 10;

type PanelState = { mode: "none" } | { mode: "create" } | { mode: "detail"; work: Work };

/** Render the full works management page. */
export function WorksPage(): ReactElement {
  const { t } = useTranslation(["works", "nav", "common"]);
  const navigate = useNavigate();
  const { notify } = useToast();
  const { setCurrentWorkId } = useApp();
  const { slot, setPageOwnsPanel, setCollapsed } = useAssistant();

  const [works, setWorks] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "updated_at",
    direction: "descending",
  });

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [structures, setStructures] = useState<StoryStructure[]>([]);
  const [panel, setPanel] = useState<PanelState>({ mode: "none" });
  const [pendingDelete, setPendingDelete] = useState<Work | null>(null);

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

  const loadWorks = useCallback(async () => {
    try {
      const data = await listWorks({
        search,
        sortBy: String(sortDescriptor.column),
        order: sortDescriptor.direction === "ascending" ? "asc" : "desc",
        page,
        pageSize: PAGE_SIZE,
      });
      setWorks(data.items);
      setTotal(data.total);
    } catch {
      notify(t("works:toast.loadWorksFailed"), "error");
    }
  }, [search, sortDescriptor, page, notify, t]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  useEffect(() => {
    void (async () => {
      try {
        const [seriesData, structureData] = await Promise.all([listSeries(), listStructures()]);
        setSeriesList(seriesData);
        setStructures(structureData);
      } catch {
        notify(t("works:toast.loadMetaFailed"), "error");
      }
    })();
  }, [notify, t]);

  function openWork(work: Work, path: string): void {
    setCurrentWorkId(work.id);
    navigate(path);
  }

  async function handleStatusChange(work: Work, status: string): Promise<void> {
    if (status === work.status) {
      return;
    }
    try {
      const saved = await updateWork(work.id, { status });
      setWorks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setPanel((current) =>
        current.mode === "detail" && current.work.id === saved.id
          ? { mode: "detail", work: saved }
          : current,
      );
    } catch {
      notify(t("works:toast.statusUpdateFailed"), "error");
    }
  }

  async function handleExport(work: Work, format: "json" | "md"): Promise<void> {
    try {
      await downloadWorkExport(work.id, format);
      notify(t("works:toast.exportStarted"), "success");
    } catch {
      notify(t("works:toast.exportFailed"), "error");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteWork(pendingDelete.id);
      notify(t("works:toast.deleted"), "success");
      setPanel((current) =>
        current.mode === "detail" && current.work.id === pendingDelete.id
          ? { mode: "none" }
          : current,
      );
      await loadWorks();
    } catch {
      notify(t("works:toast.deleteFailed"), "error");
    } finally {
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prepLabel = t("works:progress.prep");

  const assistantContent =
    panel.mode === "create" ? (
      <WorkCreateForm
        seriesList={seriesList}
        structures={structures}
        onSeriesCreated={(series) => setSeriesList((current) => [series, ...current])}
        onStructureCreated={(structure) => setStructures((current) => [...current, structure])}
        onCreated={(work) => {
          setPanel({ mode: "none" });
          setCurrentWorkId(work.id);
          notify(t("works:toast.created"), "success");
          navigate("/outline");
        }}
        onCancel={() => setPanel({ mode: "none" })}
      />
    ) : panel.mode === "detail" ? (
      <WorkDetailPanel
        key={panel.work.id}
        work={panel.work}
        seriesList={seriesList}
        structures={structures}
        onSeriesCreated={(series) => setSeriesList((current) => [series, ...current])}
        onStructureCreated={(structure) => setStructures((current) => [...current, structure])}
        onSaved={(work) => {
          setPanel({ mode: "detail", work });
          setWorks((current) => current.map((item) => (item.id === work.id ? work : item)));
        }}
        onCancel={() => setPanel({ mode: "none" })}
      />
    ) : null;

  return (
    <section className="workspace-page">
      <div className="page-header">
        <div>
          <h1>{t("works:page.title")}</h1>
          <p>{t("works:page.subtitle")}</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          onPress={() => openPanel({ mode: "create" })}
        >
          {t("works:actions.createWork")}
        </Button>
      </div>

      <Input
        className="search-input"
        placeholder={t("works:page.searchPlaceholder")}
        startContent={<Search size={16} />}
        value={searchInput}
        onValueChange={setSearchInput}
        isClearable
        onClear={() => setSearchInput("")}
      />

      <Table
        aria-label={t("works:page.tableLabel")}
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor);
          setPage(1);
        }}
      >
        <TableHeader>
          <TableColumn key="series">{t("works:columns.series")}</TableColumn>
          <TableColumn key="title" allowsSorting>
            {t("works:columns.title")}
          </TableColumn>
          <TableColumn key="structure">{t("works:columns.structure")}</TableColumn>
          <TableColumn key="status" allowsSorting>
            {t("works:columns.status")}
          </TableColumn>
          <TableColumn key="progress">{t("works:columns.progress")}</TableColumn>
          <TableColumn key="word_count" allowsSorting>
            {t("works:columns.wordCount")}
          </TableColumn>
          <TableColumn key="created_at" allowsSorting>
            {t("works:columns.createdAt")}
          </TableColumn>
          <TableColumn key="updated_at" allowsSorting>
            {t("works:columns.updatedAt")}
          </TableColumn>
          <TableColumn key="actions">{t("works:columns.actions")}</TableColumn>
        </TableHeader>
        <TableBody emptyContent={t("works:page.empty")}>
          {works.map((work) => {
            const progress = computeProgress(work);
            return (
              <TableRow key={work.id}>
                <TableCell>{work.series_name ?? "-"}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => openPanel({ mode: "detail", work })}
                  >
                    {work.title}
                  </button>
                </TableCell>
                <TableCell>
                  {work.structure_name
                    ? translatePresetStructureName(work.structure_name, t)
                    : "-"}
                </TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat" color={workStatusColor(work.status)}>
                        {t(workStatusLabelKey(work.status))}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label={t("works:status.changeLabel")}
                      onAction={(key) => void handleStatusChange(work, String(key))}
                    >
                      {WORK_STATUS_VALUES.map((value) => (
                        <DropdownItem key={value}>{t(workStatusLabelKey(value))}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
                <TableCell>
                  {progress.isPrep ? (
                    <Chip size="sm" variant="flat">
                      {prepLabel}
                    </Chip>
                  ) : (
                    <div className="progress-cell">
                      <Progress aria-label={t("works:progress.ariaLabel")} size="sm" value={progress.percent} />
                      <span>{progress.label}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>{work.total_word_count.toLocaleString()}</TableCell>
                <TableCell>{work.created_at}</TableCell>
                <TableCell>{work.updated_at}</TableCell>
                <TableCell>
                  <div className="row-actions">
                    <Tooltip content={t("nav:worldbuilding")}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label={t("nav:worldbuilding")}
                        onPress={() => openWork(work, "/worldbuilding")}
                      >
                        <Sparkles size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("nav:outline")}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label={t("nav:outline")}
                        onPress={() => openWork(work, "/outline")}
                      >
                        <FileText size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("nav:writing")}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label={t("nav:writing")}
                        onPress={() => openWork(work, "/writing")}
                      >
                        <PenLine size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={t("nav:review")}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label={t("nav:review")}
                        onPress={() => openWork(work, "/review")}
                      >
                        <SearchCheck size={16} />
                      </Button>
                    </Tooltip>
                    <Dropdown>
                      <Tooltip content={t("works:actions.export")}>
                        <div>
                          <DropdownTrigger>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              aria-label={t("works:actions.export")}
                            >
                              <Download size={16} />
                            </Button>
                          </DropdownTrigger>
                        </div>
                      </Tooltip>
                      <DropdownMenu
                        aria-label={t("works:actions.exportFormatLabel")}
                        onAction={(key) => void handleExport(work, key as "json" | "md")}
                      >
                        <DropdownItem key="json">{t("works:actions.exportJson")}</DropdownItem>
                        <DropdownItem key="md">{t("works:actions.exportMarkdown")}</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                    <Tooltip content={t("works:actions.delete")} color="danger">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label={t("works:actions.delete")}
                        onPress={() => setPendingDelete(work)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="pagination-row">
          <Pagination total={totalPages} page={page} onChange={setPage} showControls />
        </div>
      )}

      {slot && assistantContent && createPortal(assistantContent, slot)}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={t("works:deleteDialog.title")}
        body={t("works:deleteDialog.body", { title: pendingDelete?.title ?? "" })}
        confirmLabel={t("works:actions.delete")}
        cancelLabel={t("common:cancel")}
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
