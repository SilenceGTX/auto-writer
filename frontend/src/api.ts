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

export async function createStory(title: string, series_id?: number): Promise<Story> {
  const params = new URLSearchParams({ title });
  if (series_id) params.set("series_id", String(series_id));
  const res = await fetch(`${BASE}/stories/?${params}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create story");
  return res.json();
}

export async function updateStory(
  id: number,
  data: Partial<Pick<Story, "title" | "series_id" | "status" | "description" | "genre" | "save_path">>,
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
