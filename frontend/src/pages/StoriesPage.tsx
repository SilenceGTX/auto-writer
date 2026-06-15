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

  // new series inline
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

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
    await createStory(newTitle.trim(), newSeriesId);
    setNewTitle("");
    setNewSeriesId(undefined);
    setShowCreate(false);
    fetchData();
  };

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;
    const s = await createSeries(newSeriesName.trim());
    setNewSeriesName("");
    setShowNewSeries(false);
    setSeriesList((prev) => [...prev, s]);
    setNewSeriesId(s.id);
  };

  const handleDelete = async (id: number) => {
    await deleteStory(id);
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
                  <span className={"status-tag" + (s.status === "完结" ? " done" : "")}>
                    {s.status || "连载"}
                  </span>
                </div>
                <div className="story-card-time">
                  最后编辑：{s.updated_at ? s.updated_at.slice(0, 10) : "-"}
                </div>
                <div className="story-card-actions">
                  <button onClick={() => navigate(`/write?story=${s.id}`)}>继续写作</button>
                  <button className="danger" onClick={() => handleDelete(s.id)}>
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
                      <button onClick={() => navigate(`/write?story=${s.id}`)}>写作</button>
                      <button className="danger" onClick={() => handleDelete(s.id)}>
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
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
            <div className="modal-actions">
              <button onClick={handleCreate}>创建作品</button>
              <button className="secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoriesPage;
