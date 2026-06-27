/** Works page: searchable, sortable, paginated works table with a contextual
 * assistant panel for creating and editing works (``STORY_PAGE_DESIGN.md``).
 */
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
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
import { WorkCreateForm } from "./works/WorkCreateForm";
import { WorkDetailPanel } from "./works/WorkDetailPanel";

const PAGE_SIZE = 10;
const WORK_STATUSES = ["创作中", "已完成", "搁置"];

type PanelState = { mode: "none" } | { mode: "create" } | { mode: "detail"; work: Work };

/** Map a work status to a chip color. */
function statusColor(status: string): "primary" | "success" | "default" {
  if (status === "已完成") return "success";
  if (status === "创作中") return "primary";
  return "default";
}

/** Render the full works management page. */
export function WorksPage(): ReactElement {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { setCurrentWorkId } = useApp();
  const { slot, setPageOwnsPanel } = useAssistant();

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
      notify("无法加载作品列表", "error");
    }
  }, [search, sortDescriptor, page, notify]);

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
        notify("无法加载系列或故事结构", "error");
      }
    })();
  }, [notify]);

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
      notify("更新状态失败", "error");
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteWork(pendingDelete.id);
      notify("作品已删除", "success");
      setPanel((current) =>
        current.mode === "detail" && current.work.id === pendingDelete.id
          ? { mode: "none" }
          : current,
      );
      await loadWorks();
    } catch {
      notify("删除作品失败", "error");
    } finally {
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          notify("作品已创建", "success");
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
          <h1>作品</h1>
          <p>管理你的系列与作品，并进入大纲、写作或审阅流程。</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          onPress={() => setPanel({ mode: "create" })}
        >
          新建作品
        </Button>
      </div>

      <Input
        className="search-input"
        placeholder="搜索作品或系列名称"
        startContent={<Search size={16} />}
        value={searchInput}
        onValueChange={setSearchInput}
        isClearable
        onClear={() => setSearchInput("")}
      />

      <Table
        aria-label="作品列表"
        sortDescriptor={sortDescriptor}
        onSortChange={(descriptor) => {
          setSortDescriptor(descriptor);
          setPage(1);
        }}
      >
        <TableHeader>
          <TableColumn key="series">系列</TableColumn>
          <TableColumn key="title" allowsSorting>
            作品
          </TableColumn>
          <TableColumn key="structure">结构</TableColumn>
          <TableColumn key="status" allowsSorting>
            状态
          </TableColumn>
          <TableColumn key="progress">进度</TableColumn>
          <TableColumn key="word_count" allowsSorting>
            字数
          </TableColumn>
          <TableColumn key="created_at" allowsSorting>
            创建时间
          </TableColumn>
          <TableColumn key="updated_at" allowsSorting>
            更新时间
          </TableColumn>
          <TableColumn key="actions">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent="还没有作品，点击右上角“新建作品”开始创作。">
          {works.map((work) => {
            const progress = computeProgress(work);
            return (
              <TableRow key={work.id}>
                <TableCell>{work.series_name ?? "-"}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setPanel({ mode: "detail", work })}
                  >
                    {work.title}
                  </button>
                </TableCell>
                <TableCell>{work.structure_name ?? "-"}</TableCell>
                <TableCell>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button size="sm" variant="flat" color={statusColor(work.status)}>
                        {work.status}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="切换状态"
                      onAction={(key) => void handleStatusChange(work, String(key))}
                    >
                      {WORK_STATUSES.map((value) => (
                        <DropdownItem key={value}>{value}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </TableCell>
                <TableCell>
                  {progress.isPrep ? (
                    <Chip size="sm" variant="flat">
                      前期筹备
                    </Chip>
                  ) : (
                    <div className="progress-cell">
                      <Progress aria-label="写作进度" size="sm" value={progress.percent} />
                      <span>{progress.label}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>{work.total_word_count.toLocaleString()}</TableCell>
                <TableCell>{work.created_at}</TableCell>
                <TableCell>{work.updated_at}</TableCell>
                <TableCell>
                  <div className="row-actions">
                    <Tooltip content="设定">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="设定"
                        onPress={() => openWork(work, "/worldbuilding")}
                      >
                        <Sparkles size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="大纲">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="大纲"
                        onPress={() => openWork(work, "/outline")}
                      >
                        <FileText size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="写作">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="写作"
                        onPress={() => openWork(work, "/writing")}
                      >
                        <PenLine size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="审阅">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="审阅"
                        onPress={() => openWork(work, "/review")}
                      >
                        <SearchCheck size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="导出">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        aria-label="导出"
                        onPress={() => notify("导出功能将在后续阶段提供", "info")}
                      >
                        <Download size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="删除" color="danger">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        aria-label="删除"
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
        title="删除作品"
        body={`确定要删除作品「${pendingDelete?.title ?? ""}」吗？此操作不可恢复。`}
        confirmLabel="删除"
        danger
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
