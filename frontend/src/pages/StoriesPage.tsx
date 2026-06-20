/** Works management page — card grid + table view with series support. */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSeries,
  createStory,
  deleteStory,
  listSeries,
  listStories,
  type Series,
  type Story,
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";

type Tab = "recent" | "all";

function StoriesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("recent");
  const [stories, setStories] = useState<Story[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // filters for "all" tab
  const [search, setSearch] = useState("");
  const [filterSeries, setFilterSeries] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>("");

  // create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSeriesId, setNewSeriesId] = useState<number | undefined>();
  const [newStructure, setNewStructure] = useState("");
  const [newChapterGoal, setNewChapterGoal] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // structure options
  interface StructureDef {
    name: string;
    phases: string[];
    desc?: string;
  }
  const DEFAULT_STRUCTURES: StructureDef[] = [
    {
      name: "经典三幕式",
      phases: ["铺垫", "对抗", "结局"],
      desc: "最通用的故事骨架。「铺垫—对抗—结局」三部分讲述一个完整的故事，广泛应用于小说和电影。如果不知道选什么结构，选这个就好。",
    },
    {
      name: "起承转合",
      phases: ["起", "承", "转", "合"],
      desc: "东方故事的经典范式。「起（开篇）—承（发展）—转（转折/高潮）—合（结尾）」，适合短中篇、注重意境和节奏的作品。",
    },
    {
      name: "英雄之旅",
      phases: ["平凡世界", "冒险的召唤", "拒绝召唤", "遇见导师", "跨越第一道门槛", "考验、盟友与敌人", "接近深洞穴", "严峻考验", "获得奖赏", "返回之路", "复活与净化", "带着灵药归来"],
      desc: "「平凡人成为英雄」的标准模板。用 12 个阶段刻画主角从普通世界出发、历经磨难、成长蜕变、最终归来的全过程。特别适合玄幻、奇幻、成长冒险。",
    },
    {
      name: "斯奈德节拍表",
      phases: ["开场画面", "主题陈述", "铺垫", "催化剂", "行动决策", "第二幕衔接", "B 故事", "趣味与游戏", "中点", "反派之路", "一败涂地", "灵魂暗夜", "第三幕衔接", "结局", "终场画面"],
      desc: "好莱坞编剧写作指南。用 15 个关键节拍精确控制节奏，每个节拍都有明确的时长占比。适合追求商业节奏和编排的写作。",
    },
  ];
  const [structureOptions, setStructureOptions] = useState<StructureDef[]>(() => {
    const saved = localStorage.getItem("aw-structures");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge: keep user custom structures, ensure defaults have descriptions
        const defaultMap = new Map(DEFAULT_STRUCTURES.map((d) => [d.name, d]));
        const custom = parsed.filter((s: StructureDef) => !defaultMap.has(s.name));
        return [...DEFAULT_STRUCTURES, ...custom];
      } catch {
        return DEFAULT_STRUCTURES;
      }
    }
    return DEFAULT_STRUCTURES;
  });
  const [showNewStructure, setShowNewStructure] = useState(false);
  const [newStructureName, setNewStructureName] = useState("");
  const [newStructurePhases, setNewStructurePhases] = useState("");
  const [newStructureDesc, setNewStructureDesc] = useState("");

  // new series inline
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const fetchData = useCallback(async () => {
    const [s, series] = await Promise.all([listStories(), listSeries()]);
    setStories(s);
    setSeriesList(series);
  }, []);

  const fetchFiltered = useCallback(async () => {
    const s = await listStories({
      search: search || undefined,
      series_id: filterSeries,
      status: filterStatus || undefined,
    });
    setStories(s);
  }, [search, filterSeries, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === "all") fetchFiltered();
  }, [tab, fetchFiltered]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createStory(
      newTitle.trim(),
      newSeriesId,
      newStructure || undefined,
      newDescription.trim() || undefined,
      newChapterGoal ? Number(newChapterGoal) : undefined,
    );
    setNewTitle("");
    setNewSeriesId(undefined);
    setNewStructure("");
    setNewChapterGoal("");
    setNewDescription("");
    setShowCreate(false);
    fetchData();
  };

  const handleAddStructure = () => {
    if (!newStructureName.trim()) return;
    const phases = newStructurePhases
      .split("-")
      .map((p) => p.trim())
      .filter(Boolean);
    const updated = [...structureOptions, { name: newStructureName.trim(), phases }];
    setStructureOptions(updated);
    localStorage.setItem("aw-structures", JSON.stringify(updated));
    setNewStructure(newStructureName.trim());
    setNewStructureName("");
    setNewStructurePhases("");
    setNewStructureDesc("");
    setShowNewStructure(false);
  };

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;
    const s = await createSeries(newSeriesName.trim());
    setNewSeriesName("");
    setShowNewSeries(false);
    setSeriesList((prev) => [...prev, s]);
    setNewSeriesId(s.id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteStory(deleteTarget.id);
    setDeleteTarget(null);
    fetchData();
  };

  const totalWords = stories.reduce((sum, s) => sum + (s.word_count || 0), 0);

  return (
    <div className="stories-page">
      <div className="stories-header">
        <h1>作品</h1>
        <button onClick={() => setShowCreate(true)}>+ 新建作品</button>
      </div>

      <div className="stories-stats">
        <span>共 {stories.length} 部作品</span>
        <span>累计 {totalWords.toLocaleString()} 字</span>
      </div>

      {/* tabs */}
      <div className="stories-tabs">
        <button
          className={"tab-btn" + (tab === "recent" ? " active" : "")}
          onClick={() => setTab("recent")}
        >
          最近作品
        </button>
        <button
          className={"tab-btn" + (tab === "all" ? " active" : "")}
          onClick={() => setTab("all")}
        >
          全部作品
        </button>
      </div>

      {/* recent — card grid */}
      {tab === "recent" && (
        <div className="story-cards">
          {stories.length === 0 ? (
            <p className="placeholder-hint">暂无作品，点击「+ 新建作品」开始创作</p>
          ) : (
            stories.map((s) => (
              <div key={s.id} className="story-card">
                {s.series && <div className="story-card-series">{s.series.name}</div>}
                <div className="story-card-title">{s.title}</div>
                <div className="story-card-meta">
                  <span>第 {s.current_chapter || 0} 章</span>
                  <span>{(s.word_count || 0).toLocaleString()} 字</span>
                  {s.structure && <span className="structure-tag">{s.structure}</span>}
                  <span className={"status-tag" + (s.status === "完结" ? " done" : "")}>
                    {s.status || "连载"}
                  </span>
                </div>
                <div className="story-card-time">
                  最后编辑：{s.updated_at ? s.updated_at.slice(0, 10) : "-"}
                </div>
                <div className="story-card-actions">
                  <button onClick={() => navigate(`/outline?story=${s.id}`)}>编写大纲</button>
                  <button onClick={() => navigate(`/write?story=${s.id}`)}>继续写作</button>
                  <button className="danger" onClick={() => setDeleteTarget({ id: s.id, title: s.title })}>
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* all — table */}
      {tab === "all" && (
        <div className="story-table-wrap">
          <div className="story-table-filters">
            <input
              placeholder="搜索作品名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={filterSeries ?? ""}
              onChange={(e) =>
                setFilterSeries(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">全部系列</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="连载">连载</option>
              <option value="完结">完结</option>
            </select>
          </div>
          <table className="story-table">
            <thead>
              <tr>
                <th>系列</th>
                <th>作品名称</th>
                <th>进度</th>
                <th>字数</th>
                <th>状态</th>
                <th>最后编辑</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="placeholder-hint">
                    暂无匹配作品
                  </td>
                </tr>
              ) : (
                stories.map((s) => (
                  <tr key={s.id}>
                    <td>{s.series?.name || "-"}</td>
                    <td className="story-table-title">{s.title}</td>
                    <td>第 {s.current_chapter || 0} 章</td>
                    <td>{(s.word_count || 0).toLocaleString()}</td>
                    <td>
                      <span className={"status-tag" + (s.status === "完结" ? " done" : "")}>
                        {s.status || "连载"}
                      </span>
                    </td>
                    <td>{s.updated_at ? s.updated_at.slice(0, 10) : "-"}</td>
                    <td className="story-table-actions">
                      <button onClick={() => navigate(`/outline?story=${s.id}`)}>大纲</button>
                      <button onClick={() => navigate(`/write?story=${s.id}`)}>写作</button>
                      <button className="danger" onClick={() => setDeleteTarget({ id: s.id, title: s.title })}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* create dialog (modal) */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>新建作品</h2>
            <label>作品名称</label>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入作品标题..."
            />
            <label>所属系列（可选）</label>
            <div className="series-pick">
              <select
                value={newSeriesId ?? ""}
                onChange={(e) =>
                  setNewSeriesId(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">无</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="link-btn" onClick={() => setShowNewSeries(!showNewSeries)}>
                + 新建系列
              </button>
            </div>
            {showNewSeries && (
              <div className="inline-form">
                <input
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  placeholder="系列名称"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSeries()}
                />
                <button onClick={handleCreateSeries}>确认</button>
              </div>
            )}
            <label>故事结构</label>
            <div className="series-pick">
              <select
                value={newStructure}
                onChange={(e) => setNewStructure(e.target.value)}
              >
                <option value="">（不选）</option>
                {structureOptions.map((s) => (
                  <option key={s.name} value={s.name} title={s.desc || s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="link-btn" onClick={() => setShowNewStructure(!showNewStructure)}>
                + 新结构
              </button>
            </div>
            {newStructure && structureOptions.find((o) => o.name === newStructure)?.desc && (
              <div className="structure-desc">
                {structureOptions.find((o) => o.name === newStructure)!.desc}
              </div>
            )}
            {newStructure && (
              <div className="structure-phases">
                {structureOptions.find((o) => o.name === newStructure)?.phases.map((p, i) => (
                  <span key={i} className="phase-tag">{p}</span>
                ))}
              </div>
            )}
            {showNewStructure && (
              <div className="modal-overlay" onClick={() => setShowNewStructure(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h2>新建故事结构</h2>
                  <label>结构名称</label>
                  <input
                    autoFocus
                    value={newStructureName}
                    onChange={(e) => setNewStructureName(e.target.value)}
                    placeholder="如 五幕式"
                  />
                  <label>具体结构（阶段以 - 分隔）</label>
                  <input
                    value={newStructurePhases}
                    onChange={(e) => setNewStructurePhases(e.target.value)}
                    placeholder="如 开端-发展-高潮-回落-结局"
                  />
                  <label>额外描述（可选）</label>
                  <textarea
                    className="create-synopsis"
                    value={newStructureDesc}
                    onChange={(e) => setNewStructureDesc(e.target.value)}
                    placeholder="简要描述这个结构..."
                    rows={3}
                  />
                  <div className="modal-actions">
                    <button onClick={handleAddStructure}>保存</button>
                    <button className="secondary" onClick={() => setShowNewStructure(false)}>取消</button>
                  </div>
                </div>
              </div>
            )}
            <label>大致章节数量（可选）</label>
            <input
              type="number"
              value={newChapterGoal}
              onChange={(e) => setNewChapterGoal(e.target.value)}
              placeholder="如 12"
              min="0"
            />
            <label>故事简介</label>
            <textarea
              className="create-synopsis"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="简要描述故事内容..."
              rows={4}
            />
            <div className="modal-actions">
              <button onClick={handleCreate}>创建作品</button>
              <button className="secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={
          <>
            确定要删除作品「<strong>{deleteTarget?.title}</strong>」吗？此操作不可撤销。
          </>
        }
        confirmLabel="删除"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default StoriesPage;
