/** Outline page — chapter sidebar + scene cards with plot items. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  type Chapter,
  type PlotItem,
  type Scene,
  type Story,
  createChapter,
  createPlotItem,
  createScene,
  deleteChapter,
  deletePlotItem,
  deleteScene,
  exportChapterScenes,
  getStory,
  listChapters,
  listPlotItemTypes,
  listPlotItems,
  listScenes,
  listStories,
  reorderPlotItems,
  reorderScenes,
  updateChapter,
  updatePlotItem,
  updateScene,
  updateStory,
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";

const PLOT_ITEM_LABELS: Record<string, string> = {
  "目标": "🎯 目标",
  "铺垫": "📝 铺垫",
  "推进": "▶️ 推进",
  "冲突": "⚡ 冲突",
  "反转": "🔄 反转",
  "高潮": "🔥 高潮",
  "结尾": "🏁 结尾",
};

function OutlinePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const storyId = Number(searchParams.get("story")) || 0;

  // Restore last edited story when entering without a specific story
  useEffect(() => {
    if (storyId) {
      localStorage.setItem("aw-last-story", String(storyId));
    } else {
      listStories().then((s) => {
        setStoryCount(s.length);
        if (s.length > 0) {
          const last = localStorage.getItem("aw-last-story");
          if (last) {
            navigate(`${location.pathname}?story=${last}`, { replace: true });
          }
        }
      });
    }
  }, [storyId, navigate]);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);

  const chapterTitleRef = useRef<HTMLInputElement>(null);

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "chapter" | "scene" | "item";
    id: number;
    label: string;
    parentId?: number; // sceneId for items, chapterId for scenes
  } | null>(null);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneItems, setSceneItems] = useState<Record<number, PlotItem[]>>({});
  const [itemTypes, setItemTypes] = useState<string[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [synopsis, setSynopsis] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("aw-sidebar-width");
    return saved ? Number(saved) : 220;
  });
  const [storyCount, setStoryCount] = useState<number | null>(null);

  const sidebarRef = useRef<HTMLElement>(null);
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Load chapters
  const loadChapters = useCallback(async () => {
    if (!storyId) return;
    const chs = await listChapters(storyId);
    setChapters(chs);
    if (chs.length > 0 && selectedChapterId === null) {
      setSelectedChapterId(chs[0].id);
    }
  }, [storyId, selectedChapterId]);

  // Load scenes for selected chapter
  const loadScenes = useCallback(async () => {
    if (!selectedChapterId) return;
    const scs = await listScenes(selectedChapterId);
    setScenes(scs);
    // Load items for each scene
    const itemsMap: Record<number, PlotItem[]> = {};
    for (const s of scs) {
      itemsMap[s.id] = await listPlotItems(s.id);
    }
    setSceneItems(itemsMap);
    // Update chapter title input
    const ch = chapters.find((c) => c.id === selectedChapterId);
    if (ch) setChapterTitle(ch.title);
  }, [selectedChapterId, chapters]);

  useEffect(() => { loadChapters(); }, [loadChapters]);
  useEffect(() => { loadScenes(); }, [loadScenes]);
  useEffect(() => {
    listPlotItemTypes().then(setItemTypes);
  }, []);
  useEffect(() => {
    if (storyId) {
      getStory(storyId).then((s) => {
        setStory(s);
        setSynopsis(s.description || "");
      });
    }
  }, [storyId]);

  // Resize sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - dragStartX.current;
      const w = Math.max(160, Math.min(500, dragStartWidth.current + delta));
      setSidebarWidth(w);
      localStorage.setItem("aw-sidebar-width", String(w));
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
      document.body.classList.remove("resizing");
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Chapter actions
  const handleCreateChapter = async () => {
    if (!storyId) return;
    const ch = await createChapter(storyId, `第${chapters.length + 1}章`);
    await loadChapters();
    setSelectedChapterId(ch.id);
  };

  const handleDeleteChapter = async (id: number) => {
    const ch = chapters.find((c) => c.id === id);
    setDeleteTarget({ type: "chapter", id, label: ch?.title || `章节 #${id}` });
  };

  const handleUpdateChapterTitle = async (newTitle?: string) => {
    const title = (newTitle ?? chapterTitleRef.current?.value ?? "").trim();
    if (!selectedChapterId || !title) return;
    await updateChapter(selectedChapterId, { title });
    await loadChapters();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id, parentId } = deleteTarget;
    setDeleteTarget(null);
    if (type === "chapter") {
      await deleteChapter(id);
      await loadChapters();
      if (selectedChapterId === id) {
        setSelectedChapterId(null);
        setScenes([]);
        setSceneItems({});
      }
    } else if (type === "scene") {
      await deleteScene(id);
      await loadScenes();
    } else if (type === "item" && parentId) {
      await deletePlotItem(id);
      setSceneItems((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || []).filter((i) => i.id !== id),
      }));
    }
  };

  const handleSidebarEditStart = (ch: Chapter) => {
    setEditingChapterId(ch.id);
  };

  const handleSidebarEditSave = async (chapterId: number, title: string) => {
    await updateChapter(chapterId, { title });
    setEditingChapterId(null);
    await loadChapters();
  };

  // Scene actions
  const handleCreateScene = async () => {
    if (!selectedChapterId) return;
    await createScene(selectedChapterId, "新场景");
    await loadScenes();
  };

  const handleDeleteScene = async (id: number) => {
    const sc = scenes.find((s) => s.id === id);
    setDeleteTarget({ type: "scene", id, label: sc?.title || `场景 #${id}` });
  };

  const handleUpdateSceneTitle = async (id: number, title: string) => {
    if (!title.trim()) return;
    await updateScene(id, { title: title.trim() });
    await loadScenes();
  };

  const handleSceneDrop = async (dragId: number, targetId: number) => {
    const ids = scenes.map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    // Optimistic update
    setScenes((prev) => {
      const copy = [...prev];
      const item = copy.splice(from, 1)[0];
      copy.splice(to, 0, item);
      return copy;
    });
    if (selectedChapterId) await reorderScenes(selectedChapterId, ids);
  };

  // Plot item actions
  const handleCreatePlotItem = async (sceneId: number) => {
    const item = await createPlotItem(sceneId);
    setSceneItems((prev) => ({
      ...prev,
      [sceneId]: [...(prev[sceneId] || []), item],
    }));
  };

  const handleDeletePlotItem = async (sceneId: number, itemId: number) => {
    const items = sceneItems[sceneId] || [];
    const item = items.find((i) => i.id === itemId);
    const preview = item?.description?.slice(0, 30) || `情节点 #${itemId}`;
    setDeleteTarget({ type: "item", id: itemId, label: preview, parentId: sceneId });
  };

  const handleUpdatePlotItem = async (itemId: number, data: Partial<Pick<PlotItem, "item_type" | "description">>) => {
    await updatePlotItem(itemId, data);
    await loadScenes();
  };

  const handleItemDrop = async (sceneId: number, dragId: number, targetId: number) => {
    const items = sceneItems[sceneId] || [];
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setSceneItems((prev) => {
      const copy = [...(prev[sceneId] || [])];
      const item = copy.splice(from, 1)[0];
      copy.splice(to, 0, item);
      return { ...prev, [sceneId]: copy };
    });
    await reorderPlotItems(sceneId, ids);
  };

  const handleExport = async () => {
    if (!selectedChapterId) return;
    await exportChapterScenes(selectedChapterId);
    alert("已导出到 data/exports/ 目录");
  };

  const handleSaveSynopsis = async () => {
    if (!storyId || !synopsis.trim()) return;
    await updateStory(storyId, { description: synopsis.trim() });
    setStory((prev) => prev ? { ...prev, description: synopsis.trim() } : prev);
  };

  if (!storyId) {
    if (storyCount === 0) {
      return (
        <div className="write-page">
          <h1>大纲</h1>
          <p className="placeholder-hint">还没有作品，请先前往「作品」页面新建作品。</p>
        </div>
      );
    }
    return <div className="write-page"><p>请先从作品列表选择作品。</p></div>;
  }

  return (
    <div className="write-workspace">
      {/* Chapter Sidebar */}
      <aside
        ref={sidebarRef}
        className="chapter-sidebar"
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        <div className="story-breadcrumb">
          {story?.series?.name
            ? `${story.series.name} / ${story.title}`
            : story?.title}
        </div>
        <h3>📖 章节</h3>
        <ul className="chapter-list">
          <li
            className={selectedChapterId === 0 ? "active synopsis-item" : "synopsis-item"}
            onClick={() => setSelectedChapterId(0)}
          >
            <span>📝 作品简介</span>
          </li>
          {chapters.map((ch) => (
            <li
              key={ch.id}
              className={ch.id === selectedChapterId ? "active" : ""}
              onClick={() => setSelectedChapterId(ch.id)}
            >
              {editingChapterId === ch.id ? (
                <input
                  className="chapter-inline-input"
                  autoFocus
                  defaultValue={ch.title}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== ch.title) {
                      handleSidebarEditSave(ch.id, val);
                    } else {
                      setEditingChapterId(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && val !== ch.title) {
                        handleSidebarEditSave(ch.id, val);
                      } else {
                        setEditingChapterId(null);
                      }
                    } else if (e.key === "Escape") {
                      setEditingChapterId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleSidebarEditStart(ch);
                  }}
                  title="双击编辑标题"
                >
                  {ch.title}
                </span>
              )}
              <button
                className="btn-delete-small"
                onClick={(e) => { e.stopPropagation(); handleDeleteChapter(ch.id); }}
                title="删除章节"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-add" onClick={handleCreateChapter}>+ 新建章节</button>
      </aside>

      <div
        className="sidebar-resize-handle"
        onMouseDown={(e) => {
          draggingRef.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = sidebarWidth;
          document.body.classList.add("resizing");
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.type === "chapter" ? "删除章节" : deleteTarget?.type === "scene" ? "删除场景" : "删除情节点"}
        message={
          <>
            确定要删除{deleteTarget?.type === "chapter" ? "章节" : deleteTarget?.type === "scene" ? "场景" : "情节点"}
            「<strong>{deleteTarget?.label}</strong>」吗？此操作不可撤销。
          </>
        }
        confirmLabel="删除"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Scene Workspace */}
      <main className="scene-workspace">
        {selectedChapterId === 0 ? (
          <div className="synopsis-workspace">
            <textarea
              className="synopsis-textarea"
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              onBlur={handleSaveSynopsis}
              placeholder="在这里写下作品简介..."
            />
          </div>
        ) : !selectedChapterId ? (
          <p className="placeholder">选择一个章节，开始管理场景。</p>
        ) : (
          <>
            <div className="chapter-header">
              <input
                ref={chapterTitleRef}
                className="chapter-title-input"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                onBlur={() => handleUpdateChapterTitle()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUpdateChapterTitle();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <button className="btn-tool" onClick={handleCreateScene}>+ 添加场景</button>
              <button className="btn-tool" onClick={handleExport}>开始生成</button>
            </div>

            <div className="scene-cards">
              {scenes.map((scene, idx) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={idx}
                  items={sceneItems[scene.id] || []}
                  itemTypes={itemTypes}
                  onUpdateTitle={handleUpdateSceneTitle}
                  onDelete={handleDeleteScene}
                  onDrop={handleSceneDrop}
                  onCreateItem={handleCreatePlotItem}
                  onDeleteItem={handleDeletePlotItem}
                  onUpdateItem={handleUpdatePlotItem}
                  onItemDrop={handleItemDrop}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---- SceneCard ----

interface SceneCardProps {
  scene: Scene;
  index: number;
  items: PlotItem[];
  itemTypes: string[];
  onUpdateTitle: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onDrop: (dragId: number, targetId: number) => void;
  onCreateItem: (sceneId: number) => void;
  onDeleteItem: (sceneId: number, itemId: number) => void;
  onUpdateItem: (itemId: number, data: Partial<Pick<PlotItem, "item_type" | "description">>) => void;
  onItemDrop: (sceneId: number, dragId: number, targetId: number) => void;
}

function SceneCard(props: SceneCardProps) {
  const { scene, items, itemTypes } = props;
  const [title, setTitle] = useState(scene.title);
  const [folded, setFolded] = useState(false);

  const handleTitleSave = () => {
    if (title.trim() && title.trim() !== scene.title) {
      props.onUpdateTitle(scene.id, title.trim());
    }
  };

  return (
    <div
      className="scene-card"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("scene-id", String(scene.id)); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = Number(e.dataTransfer.getData("scene-id"));
        if (dragId && dragId !== scene.id) props.onDrop(dragId, scene.id);
      }}
    >
      <div className="scene-header">
        <span className="drag-handle" title="拖拽排序">⠿</span>
        <button
          className="scene-fold-btn"
          onClick={() => setFolded(!folded)}
          title={folded ? "展开" : "折叠"}
        >
          {folded ? "▶" : "▼"}
        </button>
        <input
          className="scene-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); }}
        />
        <span className="scene-order">#{props.index + 1}</span>
        <button className="btn-delete-small" onClick={() => props.onDelete(scene.id)}>×</button>
      </div>

      {!folded && (
        <>
          <div className="plot-items">
            {items.map((item, idx) => (
              <PlotItemRow
                key={item.id}
                item={item}
                index={idx}
                sceneId={scene.id}
                itemTypes={itemTypes}
                onUpdate={props.onUpdateItem}
                onDelete={props.onDeleteItem}
                onDrop={props.onItemDrop}
              />
            ))}
          </div>

          <button className="btn-add-item" onClick={() => props.onCreateItem(scene.id)}>
            + 添加情节点
          </button>
        </>
      )}
    </div>
  );
}

// ---- PlotItemRow ----

interface PlotItemRowProps {
  item: PlotItem;
  index: number;
  sceneId: number;
  itemTypes: string[];
  onUpdate: (itemId: number, data: Partial<Pick<PlotItem, "item_type" | "description">>) => void;
  onDelete: (sceneId: number, itemId: number) => void;
  onDrop: (sceneId: number, dragId: number, targetId: number) => void;
}

function PlotItemRow(props: PlotItemRowProps) {
  const { item, sceneId, itemTypes } = props;
  const [desc, setDesc] = useState(item.description);
  const [type, setType] = useState(item.item_type);

  const handleDescSave = () => {
    if (desc !== item.description) props.onUpdate(item.id, { description: desc });
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    props.onUpdate(item.id, { item_type: newType });
  };

  return (
    <div
      className="plot-item-row"
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("item-id", String(item.id)); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = Number(e.dataTransfer.getData("item-id"));
        if (dragId && dragId !== item.id) props.onDrop(sceneId, dragId, item.id);
      }}
    >
      <span className="drag-handle" title="拖拽排序">⠿</span>
      <select
        className="item-type-select"
        value={type}
        onChange={(e) => handleTypeChange(e.target.value)}
      >
        {itemTypes.map((t) => (
          <option key={t} value={t}>{PLOT_ITEM_LABELS[t] || t}</option>
        ))}
      </select>
      <textarea
        className="item-desc"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={handleDescSave}
        rows={2}
        placeholder="描述这个情节点..."
      />
      <button
        className="btn-delete-small"
        onClick={() => props.onDelete(sceneId, item.id)}
        title="删除情节点"
      >
        ×
      </button>
    </div>
  );
}

export default OutlinePage;
