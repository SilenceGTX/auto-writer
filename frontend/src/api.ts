/** API client helpers for communicating with the Auto-Writer backend. */

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface Series {
  id: number;
  name: string;
  created_at: string;
}

export interface Story {
  id: number;
  title: string;
  description: string;
  structure: string;
  status: string;
  chapter_goal: number;
  word_count: number;
  series_id: number | null;
  series: Series | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStoryInput {
  title: string;
  description: string;
  structure: string;
  chapter_goal: number;
  series_id: number | null;
}

/** Fetch JSON from the backend and raise readable errors for non-OK responses. */
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Fetch all available story series. */
export async function listSeries(): Promise<Series[]> {
  return requestJson<Series[]>("/series");
}

/** Create a new story series. */
export async function createSeries(name: string): Promise<Series> {
  return requestJson<Series>("/series", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** Fetch stories, optionally filtered by title text. */
export async function listStories(search?: string): Promise<Story[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return requestJson<Story[]>(`/stories${params}`);
}

/** Create a new story project. */
export async function createStory(input: CreateStoryInput): Promise<Story> {
  return requestJson<Story>("/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Delete a story project by ID. */
export async function deleteStory(storyId: number): Promise<void> {
  await requestJson<void>(`/stories/${storyId}`, { method: "DELETE" });
}
