/** API client for communicating with the backend. */

const BASE = "/api";

// ---- types ----

export interface Series {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: number;
  series_id: number | null;
  title: string;
  description: string;
  genre: string;
  status: string;
  structure: string;
  chapter_goal: number;
  word_count: number;
  current_chapter: number;
  save_path: string;
  created_at: string;
  updated_at: string;
  series?: Series | null;
}

export interface StoryFilters {
  series_id?: number;
  status?: string;
  search?: string;
}

export interface Chapter {
  id: number;
  story_id: number;
  title: string;
  content: string;
  order: number;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: number;
  chapter_id: number;
  title: string;
  description: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface PlotItem {
  id: number;
  scene_id: number;
  item_type: string;
  description: string;
  order: number;
  created_at: string;
  updated_at: string;
}

// ---- series ----

export async function listSeries(): Promise<Series[]> {
  const res = await fetch(`${BASE}/series/`);
  if (!res.ok) throw new Error("Failed to fetch series");
  return res.json();
}

export async function createSeries(name: string, description?: string): Promise<Series> {
  const params = new URLSearchParams({ name });
  if (description) params.set("description", description);
  const res = await fetch(`${BASE}/series/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create series");
  return res.json();
}

export async function deleteSeries(id: number): Promise<void> {
  await fetch(`${BASE}/series/${id}`, { method: "DELETE" });
}

// ---- stories ----

export async function listStories(filters?: StoryFilters): Promise<Story[]> {
  const params = new URLSearchParams();
  if (filters?.series_id) params.set("series_id", String(filters.series_id));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  const res = await fetch(`${BASE}/stories/${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error("Failed to fetch stories");
  return res.json();
}

export async function createStory(
  title: string,
  series_id?: number,
  structure?: string,
  description?: string,
  chapter_goal?: number,
): Promise<Story> {
  const params = new URLSearchParams({ title });
  if (series_id) params.set("series_id", String(series_id));
  if (structure) params.set("structure", structure);
  if (description) params.set("description", description);
  if (chapter_goal) params.set("chapter_goal", String(chapter_goal));
  const res = await fetch(`${BASE}/stories/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create story");
  return res.json();
}

export async function updateStory(
  id: number,
  data: Partial<Pick<Story, "title" | "series_id" | "status" | "description" | "genre" | "save_path" | "structure" | "chapter_goal">>,
): Promise<Story> {
  const res = await fetch(`${BASE}/stories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update story");
  return res.json();
}

export async function deleteStory(id: number): Promise<void> {
  await fetch(`${BASE}/stories/${id}`, { method: "DELETE" });
}

export async function getStory(id: number): Promise<Story> {
  const res = await fetch(`${BASE}/stories/${id}`);
  if (!res.ok) throw new Error("Failed to fetch story");
  return res.json();
}

// ---- chapters ----

export async function listChapters(story_id: number): Promise<Chapter[]> {
  const res = await fetch(`${BASE}/chapters/?story_id=${story_id}`);
  if (!res.ok) throw new Error("Failed to fetch chapters");
  return res.json();
}

export async function createChapter(story_id: number, title: string): Promise<Chapter> {
  const params = new URLSearchParams({ story_id: String(story_id), title });
  const res = await fetch(`${BASE}/chapters/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create chapter");
  return res.json();
}

export async function updateChapter(
  id: number,
  data: Partial<Pick<Chapter, "title" | "content" | "summary">>,
): Promise<Chapter> {
  const res = await fetch(`${BASE}/chapters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update chapter");
  return res.json();
}

export async function deleteChapter(id: number): Promise<void> {
  await fetch(`${BASE}/chapters/${id}`, { method: "DELETE" });
}

// ---- scenes ----

export async function listScenes(chapter_id: number): Promise<Scene[]> {
  const res = await fetch(`${BASE}/scenes/?chapter_id=${chapter_id}`);
  if (!res.ok) throw new Error("Failed to fetch scenes");
  return res.json();
}

export async function createScene(chapter_id: number, title: string): Promise<Scene> {
  const params = new URLSearchParams({ chapter_id: String(chapter_id), title });
  const res = await fetch(`${BASE}/scenes/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create scene");
  return res.json();
}

export async function updateScene(
  id: number,
  data: Partial<Pick<Scene, "title" | "description">>,
): Promise<Scene> {
  const res = await fetch(`${BASE}/scenes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update scene");
  return res.json();
}

export async function reorderScenes(chapter_id: number, ids: number[]): Promise<void> {
  await fetch(`${BASE}/scenes/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chapter_id, ids }),
  });
}

export async function deleteScene(id: number): Promise<void> {
  await fetch(`${BASE}/scenes/${id}`, { method: "DELETE" });
}

export async function exportScene(scene_id: number): Promise<{ path: string }> {
  const res = await fetch(`${BASE}/scenes/${scene_id}/export`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to export scene");
  return res.json();
}

export async function exportChapterScenes(chapter_id: number): Promise<{ paths: string[] }> {
  const res = await fetch(`${BASE}/scenes/export-chapter/${chapter_id}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to export chapter");
  return res.json();
}

// ---- plot items ----

export async function listPlotItems(scene_id: number): Promise<PlotItem[]> {
  const res = await fetch(`${BASE}/plot-items/?scene_id=${scene_id}`);
  if (!res.ok) throw new Error("Failed to fetch plot items");
  return res.json();
}

export async function listPlotItemTypes(): Promise<string[]> {
  const res = await fetch(`${BASE}/plot-items/types`);
  if (!res.ok) throw new Error("Failed to fetch plot item types");
  return res.json();
}

export async function createPlotItem(
  scene_id: number,
  item_type?: string,
  description?: string,
): Promise<PlotItem> {
  const params = new URLSearchParams({ scene_id: String(scene_id) });
  if (item_type) params.set("item_type", item_type);
  if (description) params.set("description", description);
  const res = await fetch(`${BASE}/plot-items/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create plot item");
  return res.json();
}

export async function updatePlotItem(
  id: number,
  data: Partial<Pick<PlotItem, "item_type" | "description">>,
): Promise<PlotItem> {
  const res = await fetch(`${BASE}/plot-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update plot item");
  return res.json();
}

export async function reorderPlotItems(scene_id: number, ids: number[]): Promise<void> {
  await fetch(`${BASE}/plot-items/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene_id, ids }),
  });
}

export async function deletePlotItem(id: number): Promise<void> {
  await fetch(`${BASE}/plot-items/${id}`, { method: "DELETE" });
}

// ---- world entities ----

export interface WorldEntity {
  id: number;
  story_id: number;
  entity_type: string;
  name: string;
  properties: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface EntityType {
  code: string;
  label: string;
  count: number;
}

export async function listEntityTypes(story_id: number): Promise<EntityType[]> {
  const res = await fetch(`${BASE}/world-entities/types?story_id=${story_id}`);
  if (!res.ok) throw new Error("Failed to fetch entity types");
  return res.json();
}

export async function listWorldEntities(
  story_id: number,
  entity_type?: string,
  search?: string,
): Promise<WorldEntity[]> {
  const params = new URLSearchParams({ story_id: String(story_id) });
  if (entity_type) params.set("entity_type", entity_type);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}/world-entities/?${params}`);
  if (!res.ok) throw new Error("Failed to fetch entities");
  return res.json();
}

export async function createWorldEntity(
  story_id: number,
  entity_type: string,
  name: string,
  properties?: string,
): Promise<WorldEntity> {
  const res = await fetch(`${BASE}/world-entities/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      story_id,
      entity_type,
      name,
      properties: properties || "{}",
    }),
  });
  if (!res.ok) throw new Error("Failed to create entity");
  return res.json();
}

export async function updateWorldEntity(
  id: number,
  data: Partial<Pick<WorldEntity, "name" | "properties">>,
): Promise<WorldEntity> {
  const res = await fetch(`${BASE}/world-entities/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update entity");
  return res.json();
}

export async function deleteWorldEntity(id: number): Promise<void> {
  await fetch(`${BASE}/world-entities/${id}`, { method: "DELETE" });
}
