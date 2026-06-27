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
  series_name: string | null;
  structure_name: string | null;
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

export interface UpdateWorkInput {
  title?: string;
  series_id?: number | null;
  structure_id?: number | null;
  planned_chapter_count?: number | null;
  status?: string;
  summary?: string;
}

export interface CreateStructureInput {
  name: string;
  stages: string[];
  description?: string;
}

export interface WorkListParams {
  search?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface WorkListResponse {
  items: Work[];
  total: number;
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

/** Delete a series by id (member works keep their data, series_id cleared). */
export async function deleteSeries(seriesId: number): Promise<void> {
  await requestJson<void>(`/series/${seriesId}`, { method: "DELETE" });
}

/** List all story structures (presets first). */
export async function listStructures(): Promise<StoryStructure[]> {
  return requestJson<StoryStructure[]>("/structures");
}

/** Create a user-defined story structure. */
export async function createStructure(input: CreateStructureInput): Promise<StoryStructure> {
  return requestJson<StoryStructure>("/structures", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** List works with optional search, sorting, and pagination. */
export async function listWorks(params: WorkListParams = {}): Promise<WorkListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.sortBy) query.set("sort_by", params.sortBy);
  if (params.order) query.set("order", params.order);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<WorkListResponse>(`/works${suffix}`);
}

/** Create a new work. */
export async function createWork(input: CreateWorkInput): Promise<Work> {
  return requestJson<Work>("/works", { method: "POST", body: JSON.stringify(input) });
}

/** Partially update a work. */
export async function updateWork(workId: number, input: UpdateWorkInput): Promise<Work> {
  return requestJson<Work>(`/works/${workId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Delete a work by id. */
export async function deleteWork(workId: number): Promise<void> {
  await requestJson<void>(`/works/${workId}`, { method: "DELETE" });
}

export interface ConnectionSettings {
  url: string;
  api_token: string;
  model: string;
}

export interface StagePreference {
  temperature: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  max_tokens: number | null;
}

export interface Preferences {
  outline: StagePreference;
  writing: StagePreference;
}

export interface WritingStyle {
  text: string;
}

export interface AppSettings {
  connection: ConnectionSettings;
  preferences: Preferences;
  writing_style: WritingStyle;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  sample: string | null;
}

/** Load all application settings (merged with backend defaults). */
export async function getSettings(): Promise<AppSettings> {
  return requestJson<AppSettings>("/settings");
}

/** Persist the LLM connection configuration. */
export async function updateConnection(input: ConnectionSettings): Promise<ConnectionSettings> {
  return requestJson<ConnectionSettings>("/settings/connection", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Persist the global generation preferences. */
export async function updatePreferences(input: Preferences): Promise<Preferences> {
  return requestJson<Preferences>("/settings/preferences", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Persist the global writing-style text. */
export async function updateWritingStyle(input: WritingStyle): Promise<WritingStyle> {
  return requestJson<WritingStyle>("/settings/writing_style", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Test an LLM connection with a lightweight completion. */
export async function testConnection(input: ConnectionSettings): Promise<ConnectionTestResult> {
  return requestJson<ConnectionTestResult>("/llm/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
