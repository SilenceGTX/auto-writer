/** API client and shared types for communicating with the Auto-Writer backend. */

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export interface Series {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface StoryStructure {
  id: number;
  name: string;
  stages: string[];
  description: string | null;
  is_preset: number;
}

export interface Work {
  id: number;
  title: string;
  series_id: number | null;
  structure_id: number | null;
  planned_chapter_count: number | null;
  actual_chapter_count: number | null;
  current_chapter: number;
  total_word_count: number;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkInput {
  title: string;
  series_id?: number | null;
  structure_id?: number | null;
  planned_chapter_count?: number | null;
  summary?: string;
}

/** Error raised for non-OK HTTP responses, carrying the status code. */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fetch JSON from the backend and raise ApiError for non-OK responses. */
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || `请求失败（${response.status}）`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** List all series (newest first). */
export async function listSeries(): Promise<Series[]> {
  return requestJson<Series[]>("/series");
}

/** Create a new series. */
export async function createSeries(name: string): Promise<Series> {
  return requestJson<Series>("/series", { method: "POST", body: JSON.stringify({ name }) });
}

/** List all story structures (presets first). */
export async function listStructures(): Promise<StoryStructure[]> {
  return requestJson<StoryStructure[]>("/structures");
}

/** List works (most recently updated first). */
export async function listWorks(): Promise<Work[]> {
  return requestJson<Work[]>("/works");
}

/** Create a new work. */
export async function createWork(input: CreateWorkInput): Promise<Work> {
  return requestJson<Work>("/works", { method: "POST", body: JSON.stringify(input) });
}

/** Delete a work by id. */
export async function deleteWork(workId: number): Promise<void> {
  await requestJson<void>(`/works/${workId}`, { method: "DELETE" });
}
