/** World-building page — left entity list + right tab & detail panel. */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type EntityType,
  type Story,
  type WorldEntity,
  createWorldEntity,
  deleteWorldEntity,
  listEntityTypes,
  listStories,
  listWorldEntities,
  updateWorldEntity,
} from "../api";
import ConfirmDialog from "../components/ConfirmDialog";

function WorldBuildingPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [storyId, setStoryId] = useState<number>(() => {
    const saved = localStorage.getItem("aw-wb-story");
    return saved ? Number(saved) : 0;
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("aw-wb-sidebar");
    return saved ? Number(saved) : 220;
  });
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Resize sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - dragStartX.current;
      const w = Math.max(160, Math.min(500, dragStartWidth.current + delta));
      setSidebarWidth(w);
      localStorage.setItem("aw-wb-sidebar", String(w));
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

  const [types, setTypes] = useState<EntityType[]>([]);
  const [activeType, setActiveType] = useState("");
  const [entities, setEntities] = useState<WorldEntity[]>([]);
  const [search, setSearch] = useState("");

  // selected entity for editing in right panel
  const [selected, setSelected] = useState<WorldEntity | null>(null);
  const [editName, setEditName] = useState("");
  const [editProps, setEditProps] = useState<[string, string][]>([]);

  // new entity (modal)
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProps, setNewProps] = useState<[string, string][]>([]);

  // new type
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeCode, setNewTypeCode] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("aw-type-labels") || "{}"); } catch { return {}; }
  });

  // delete
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteTypeTarget, setDeleteTypeTarget] = useState<{ code: string; label: string; count: number } | null>(null);

  // inline name edit
  const [editingEntityId, setEditingEntityId] = useState<number | null>(null);

  useEffect(() => { listStories().then(setStories); }, []);

  useEffect(() => {
    if (!storyId && stories.length > 0) {
      const last = localStorage.getItem("aw-wb-story");
      setStoryId(last ? Number(last) : stories[0].id);
    }
  }, [stories, storyId]);

  const handleSelectStory = (id: number) => {
    setStoryId(id);
    localStorage.setItem("aw-wb-story", String(id));
    setActiveType("");
    setEntities([]);
    setSelected(null);
  };

  const loadData = useCallback(async () => {
    if (!storyId) return;
    const [t, ents] = await Promise.all([
      listEntityTypes(storyId),
      listWorldEntities(storyId, activeType || undefined, search || undefined),
    ]);
    setTypes(t);
    // Clean up any leftover placeholder entities
    const placeholders = ents.filter((e) => e.name === "_placeholder_");
    for (const p of placeholders) {
      deleteWorldEntity(p.id).catch(() => {});
    }
    setEntities(ents.filter((e) => e.name !== "_placeholder_"));
    // Merge custom types from localStorage that have no entities yet
    const seen = new Set(t.map((x) => x.code));
    const merged = [...t];
    for (const [code, label] of Object.entries(typeLabels)) {
      if (!seen.has(code)) merged.push({ code, label, count: 0 });
    }
    if (merged.length > t.length) setTypes(merged);
    if (!activeType && t.length > 0) setActiveType(t[0].code);
  }, [storyId, activeType, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Select entity for editing
  const selectEntity = (e: WorldEntity) => {
    setSelected(e);
    setEditName(e.name);
    try {
      const props = Object.entries(JSON.parse(e.properties)) as [string, string][];
      // Ensure "描述" exists and is last
      const filtered = props.filter(([k]) => k !== "desc");
      const desc = props.find(([k]) => k === "desc");
      setEditProps([...filtered, ["desc", desc ? desc[1] : ""]]);
    } catch {
      setEditProps([["desc", ""]]);
    }
  };

  const handleUpdate = async () => {
    if (!selected || !editName.trim()) return;
    const obj: Record<string, string> = {};
    editProps.forEach(([k, v]) => { if (k.trim()) obj[k.trim()] = v; });
    const updated = await updateWorldEntity(selected.id, { name: editName.trim(), properties: JSON.stringify(obj) });
    setSelected(updated);
    setEditName(updated.name);
    setEntities((prev) => prev.map((e) => e.id === updated.id ? updated : e));
  };

  const handleCreate = async () => {
    if (!newName.trim() || !activeType) return;
    const obj: Record<string, string> = {};
    newProps.forEach(([k, v]) => { if (k.trim()) obj[k.trim()] = v; });
    const created = await createWorldEntity(storyId, activeType, newName.trim(), JSON.stringify(obj));
    setShowNew(false);
    setNewName("");
    setNewProps([]);
    await loadData();
    selectEntity(created);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteWorldEntity(deleteTarget.id);
    if (selected?.id === deleteTarget.id) setSelected(null);
    setDeleteTarget(null);
    loadData();
  };

  const handleConfirmDeleteType = async () => {
    if (!deleteTypeTarget) return;
    const { code } = deleteTypeTarget;
    setDeleteTypeTarget(null);
    setTypeLabels((prev) => {
      const next = { ...prev };
      delete next[code];
      localStorage.setItem("aw-type-labels", JSON.stringify(next));
      return next;
    });
    setTypes((prev) => prev.filter((t) => t.code !== code));
    setEntities((prev) => prev.filter((e) => e.entity_type !== code));
    setSelected(null);
    if (activeType === code) setActiveType("");
    // Delete all entities of this type on the backend
    const toDelete = entities.filter((e) => e.entity_type === code);
    for (const e of toDelete) await deleteWorldEntity(e.id);
  };

  const handleInlineNameSave = async (entityId: number, name: string) => {
    const updated = await updateWorldEntity(entityId, { name });
    setEditingEntityId(null);
    setEntities((prev) => prev.map((e) => e.id === entityId ? updated : e));
    if (selected?.id === entityId) {
      setSelected(updated);
      setEditName(updated.name);
    }
  };

  const handleCreateType = async () => {
    if (!newTypeCode.trim() || !newTypeLabel.trim()) return;
    const code = newTypeCode.trim();
    const label = newTypeLabel.trim();
    const updated = { ...typeLabels, [code]: label };
    setTypeLabels(updated);
    localStorage.setItem("aw-type-labels", JSON.stringify(updated));
    // Add type to local list immediately (count 0)
    setTypes((prev) => {
      if (prev.find((t) => t.code === code)) return prev;
      return [...prev, { code, label, count: 0 }];
    });
    setShowNewType(false);
    setNewTypeCode("");
    setNewTypeLabel("");
    setActiveType(code);
  };

  const getTypeLabel = (code: string, apiLabel: string) => typeLabels[code] || apiLabel;

  // Collect known keys from entities of the active type for autocomplete
  const knownKeys: string[] = [];
  for (const e of entities) {
    try {
      for (const k of Object.keys(JSON.parse(e.properties || "{}"))) {
        if (k && !knownKeys.includes(k)) knownKeys.push(k);
      }
    } catch { /* ignore */ }
  }
  knownKeys.sort();

  const addProp = () => {
    // Insert before the last item (which is always "描述")
    setEditProps((prev) => {
      const copy = [...prev];
      copy.splice(copy.length - 1, 0, ["", ""]);
      return copy;
    });
  };
  const addNewProp = () => {
    setNewProps((prev) => {
      const copy = [...prev];
      copy.splice(copy.length - 1, 0, ["", ""]);
      return copy;
    });
  };
  const updateProp = (i: number, k: string, v: string) => {
    const next = [...editProps]; next[i] = [k, v]; setEditProps(next);
  };
  const removeProp = (i: number) => {
    // Never remove the last item (always "描述")
    if (i === editProps.length - 1) return;
    setEditProps(editProps.filter((_, idx) => idx !== i));
  };
  const isDefaultType = (code: string) => ["chara", "location", "item", "org"].includes(code);

  if (stories.length === 0) {
    return (
      <div className="write-page">
        <h1>设定</h1>
        <p className="placeholder-hint">还没有作品，请先前往「作品」页面新建作品。</p>
      </div>
    );
  }

  return (
    <div className="write-workspace">
      {/* Left: entity list */}
      <aside className="chapter-sidebar wb-left" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <select
          className="story-select"
          value={storyId || ""}
          onChange={(e) => handleSelectStory(Number(e.target.value))}
        >
          <option value="" disabled>选择作品</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>

        <input
          className="wb-search"
          placeholder="搜索条目..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ul className="chapter-list wb-entity-tree">
          {entities.map((e) => (
            <li
              key={e.id}
              className={selected?.id === e.id ? "active" : ""}
              onClick={() => selectEntity(e)}
            >
              {editingEntityId === e.id ? (
                <input
                  className="chapter-inline-input"
                  autoFocus
                  defaultValue={e.name}
                  onBlur={(ev) => {
                    const val = ev.target.value.trim();
                    if (val && val !== e.name) {
                      handleInlineNameSave(e.id, val);
                    } else {
                      setEditingEntityId(null);
                    }
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      const val = (ev.target as HTMLInputElement).value.trim();
                      if (val && val !== e.name) {
                        handleInlineNameSave(e.id, val);
                      } else {
                        setEditingEntityId(null);
                      }
                    } else if (ev.key === "Escape") {
                      setEditingEntityId(null);
                    }
                  }}
                  onClick={(ev) => ev.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(ev) => {
                    ev.stopPropagation();
                    setEditingEntityId(e.id);
                  }}
                  title="双击编辑名称"
                >
                  {e.name}
                </span>
              )}
              <button
                className="btn-delete-small"
                onClick={(ev) => { ev.stopPropagation(); setDeleteTarget({ id: e.id, name: e.name }); }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
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

      {/* Right: tabs + detail */}
      <main className="scene-workspace">
        <datalist id="wb-key-list">
          {knownKeys.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <div className="wb-tabs">
          {types.map((t) => (
            <button
              key={t.code}
              className={"wb-tab" + (t.code === activeType ? " active" : "")}
              onClick={() => { setActiveType(t.code); setSelected(null); }}
            >
              {getTypeLabel(t.code, t.label)} ({t.count})
              {!isDefaultType(t.code) && (
                <span className="wb-tab-close" onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTypeTarget({ code: t.code, label: getTypeLabel(t.code, t.label), count: t.count });
                }}>×</span>
              )}
            </button>
          ))}
          <button className="wb-tab wb-tab-add" onClick={() => setShowNewType(true)}>+</button>
          <div className="wb-tabs-spacer" />
          <button className="wb-btn-new" onClick={() => { setNewName(""); setNewProps([["desc", ""]]); setShowNew(true); }}>+ 新建条目</button>
        </div>

        {selected ? (
          <div className="wb-detail">
            <input
              className="chapter-title-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="条目名称"
            />
            <div className="kv-editor">
              {editProps.map(([k, v], i) => {
                const isDesc = i === editProps.length - 1;
                return (
                <div key={i} className={"kv-row" + (isDesc ? " kv-row-desc" : "")}>
                  {isDesc ? (
                    <span className="kv-key-label">描述</span>
                  ) : (
                    <input placeholder="名称" value={k} list="wb-key-list" onChange={(e) => updateProp(i, e.target.value, v)} />
                  )}
                  {isDesc ? (
                    <textarea
                      className="kv-desc-textarea"
                      value={v}
                      onChange={(e) => updateProp(i, k, e.target.value)}
                      placeholder="输入描述..."
                      rows={3}
                    />
                  ) : (
                    <input placeholder="值" value={v} onChange={(e) => updateProp(i, k, e.target.value)} />
                  )}
                  <button
                    className="btn-delete-small"
                    onClick={() => removeProp(i)}
                    style={isDesc ? { visibility: "hidden" as const } : undefined}
                  >×</button>
                </div>
              );})}
              <button className="btn-add-item" onClick={addProp}>+ 添加属性</button>
            </div>
            <div className="modal-actions">
              <button onClick={handleUpdate}>保存</button>
              <button className="secondary" onClick={() => setSelected(null)}>取消</button>
            </div>
          </div>
        ) : (
          <p className="placeholder">选择左侧条目查看详情</p>
        )}

        {/* New type dialog */}
        {showNewType && (
          <div className="modal-overlay">
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>新建设定类型</h2>
              <label>类型标识（英文）</label>
              <input value={newTypeCode} onChange={(e) => setNewTypeCode(e.target.value)} placeholder="如 faction" />
              <label>显示名称（中文）</label>
              <input value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} placeholder="如 势力" />
              <div className="modal-actions">
                <button onClick={handleCreateType}>创建</button>
                <button className="secondary" onClick={() => setShowNewType(false)}>取消</button>
              </div>
            </div>
          </div>
        )}

        {/* New entity modal */}
        {showNew && (
          <div className="modal-overlay">
            <div className="modal wb-modal-wide" onClick={(e) => e.stopPropagation()}>
              <h2>新建条目</h2>
              <div className="wb-field-row">
                <label>类型</label>
                <span className="wb-field-value">{getTypeLabel(activeType, types.find((t) => t.code === activeType)?.label || activeType)}</span>
              </div>
              <div className="wb-field-row">
                <label>名称</label>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="条目名称"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                />
              </div>
              <label>属性</label>
              <div className="kv-editor">
                {newProps.map(([k, v], i) => {
                  const isDesc = i === newProps.length - 1;
                  return (
                  <div key={i} className={"kv-row" + (isDesc ? " kv-row-desc" : "")}>
                    {isDesc ? (
                      <span className="kv-key-label">描述</span>
                    ) : (
                      <input
                        placeholder="名称"
                        value={k}
                        list="wb-key-list"
                        onChange={(e) => { const next = [...newProps]; next[i] = [e.target.value, v]; setNewProps(next); }}
                      />
                    )}
                    {isDesc ? (
                      <textarea
                        className="kv-desc-textarea"
                        value={v}
                        onChange={(e) => { const next = [...newProps]; next[i] = [k, e.target.value]; setNewProps(next); }}
                        placeholder="输入描述..."
                        rows={3}
                      />
                    ) : (
                      <input
                        placeholder="值"
                        value={v}
                        onChange={(e) => { const next = [...newProps]; next[i] = [k, e.target.value]; setNewProps(next); }}
                      />
                    )}
                    <button
                      className="btn-delete-small"
                      onClick={() => setNewProps(newProps.filter((_, idx) => idx !== i))}
                      style={isDesc ? { visibility: "hidden" as const } : undefined}
                    >×</button>
                  </div>
                );})}
                <button className="btn-add-item" onClick={addNewProp}>+ 添加属性</button>
              </div>
              <div className="modal-actions">
                <button onClick={handleCreate}>创建</button>
                <button className="secondary" onClick={() => setShowNew(false)}>取消</button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={deleteTarget !== null}
          title="确认删除"
          message={<>确定要删除条目「<strong>{deleteTarget?.name}</strong>」吗？</>}
          confirmLabel="删除"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
        <ConfirmDialog
          open={deleteTypeTarget !== null}
          title="删除设定类型"
          message={
            <>
              确定要删除「<strong>{deleteTypeTarget?.label}</strong>」类型及其下属的{' '}
              <strong>{deleteTypeTarget?.count}</strong> 个条目吗？此操作不可撤销。
            </>
          }
          confirmLabel="全部删除"
          danger
          onConfirm={handleConfirmDeleteType}
          onCancel={() => setDeleteTypeTarget(null)}
        />
      </main>
    </div>
  );
}

export default WorldBuildingPage;
