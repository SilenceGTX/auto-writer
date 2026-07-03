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

export interface WorkStage {
  id: number;
  work_id: number;
  name: string;
  overview: string | null;
  sort_order: number;
  chapter_count: number;
}

export interface Chapter {
  id: number;
  work_id: number;
  stage_id: number | null;
  chapter_number: number;
  title: string | null;
  summary: string | null;
  word_count: number;
  status: string;
}

export interface Outline {
  work_id: number;
  title: string;
  planned_chapter_count: number | null;
  actual_chapter_count: number | null;
  structure_name: string | null;
  locked: boolean;
  stages: WorkStage[];
  chapters: Chapter[];
}

export interface ChapterOrderItem {
  id: number;
  stage_id: number | null;
}

/** Load the full outline (stages + chapters) for a work. */
export async function getOutline(workId: number): Promise<Outline> {
  return requestJson<Outline>(`/works/${workId}/outline`);
}

/** Generate the stage tree and synopses (replaces the existing outline). */
export async function generateStages(workId: number): Promise<Outline> {
  return requestJson<Outline>(`/works/${workId}/outline/stages:generate`, { method: "POST" });
}

/** Generate per-chapter titles and summaries, locking the outline. */
export async function generateChapterOutlines(workId: number): Promise<Outline> {
  return requestJson<Outline>(`/works/${workId}/outline/chapters:generate`, { method: "POST" });
}

/** Update a stage's name and/or synopsis. */
export async function updateStage(
  stageId: number,
  input: { name?: string; overview?: string },
): Promise<WorkStage> {
  return requestJson<WorkStage>(`/stages/${stageId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Set how many chapters belong to a stage. */
export async function setStageChapterCount(stageId: number, count: number): Promise<Outline> {
  return requestJson<Outline>(`/stages/${stageId}/chapter-count`, {
    method: "PUT",
    body: JSON.stringify({ count }),
  });
}

/** Append a chapter to a work. */
export async function addChapter(
  workId: number,
  input: { title?: string; summary?: string; stage_id?: number | null } = {},
): Promise<Chapter> {
  return requestJson<Chapter>(`/works/${workId}/chapters`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Update a chapter's outline fields. */
export async function updateChapter(
  chapterId: number,
  input: { title?: string; summary?: string; status?: string; stage_id?: number | null },
): Promise<Chapter> {
  return requestJson<Chapter>(`/chapters/${chapterId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Delete a chapter by id. */
export async function deleteChapter(chapterId: number): Promise<void> {
  await requestJson<void>(`/chapters/${chapterId}`, { method: "DELETE" });
}

/** Apply a new chapter order (and stage assignment) from a drag operation. */
export async function reorderChapters(
  workId: number,
  items: ChapterOrderItem[],
): Promise<Outline> {
  return requestJson<Outline>(`/works/${workId}/chapters/reorder`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
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

export interface DataSaveSettings {
  input_debounce_seconds: number;
  autosave_interval_seconds: number;
  snapshot_path: string;
  history_versions: number;
}

export type ReadingTheme = "sepia" | "light" | "dark";

export interface TypographySettings {
  font_family: string;
  line_height: number;
  reading_theme: ReadingTheme;
}

export interface AppSettings {
  connection: ConnectionSettings;
  preferences: Preferences;
  writing_style: WritingStyle;
  data_save: DataSaveSettings;
  typography: TypographySettings;
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

/** Persist the auto-save and snapshot persistence options. */
export async function updateDataSave(input: DataSaveSettings): Promise<DataSaveSettings> {
  return requestJson<DataSaveSettings>("/settings/data_save", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Persist the reading font, line height, and eye-care theme. */
export async function updateTypography(input: TypographySettings): Promise<TypographySettings> {
  return requestJson<TypographySettings>("/settings/typography", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Export all settings groups as a single configuration document. */
export async function exportSettings(): Promise<AppSettings> {
  return requestJson<AppSettings>("/settings/export");
}

/** Import a configuration document; only the groups present are applied. */
export async function importSettings(config: Partial<AppSettings>): Promise<AppSettings> {
  return requestJson<AppSettings>("/settings/import", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

/** Test an LLM connection with a lightweight completion. */
export async function testConnection(input: ConnectionSettings): Promise<ConnectionTestResult> {
  return requestJson<ConnectionTestResult>("/llm/test", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Download a work export (JSON or Markdown) and trigger a browser save. */
export async function downloadWorkExport(workId: number, format: "json" | "md"): Promise<void> {
  const response = await fetch(`${API_BASE}/works/${workId}/export?format=${format}`);
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || `导出失败（${response.status}）`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `work-${workId}.${format}`;
  triggerDownload(blob, filename);
}

/** Download a zip of one Markdown file per chapter (skips chapters with no body). */
export async function downloadWorkChapterExport(workId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/works/${workId}/export?format=chapters`);
  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || `导出失败（${response.status}）`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `work-${workId}.zip`;
  triggerDownload(blob, filename);
}

/** Save a Blob to the user's machine via a temporary anchor element. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a backend snapshot of a work to the configured snapshot path. */
export async function snapshotWork(workId: number): Promise<{ snapshot_dir: string | null; chapters: number }> {
  return requestJson(`/works/${workId}/snapshot`, { method: "POST" });
}

export interface EntityCategory {
  id: number;
  work_id: number;
  name: string;
  is_preset: number;
  sort_order: number;
  entity_count: number;
}

export interface EntityProperty {
  name: string;
  value: string;
}

export interface WorldEntity {
  id: number;
  work_id: number;
  category_id: number;
  name: string;
  description: string | null;
  properties: EntityProperty[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EntityListParams {
  categoryId?: number | null;
  search?: string;
  sortBy?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface WorldEntityListResponse {
  items: WorldEntity[];
  total: number;
}

export interface CreateEntityInput {
  category_id: number;
  name: string;
  description?: string | null;
  properties?: EntityProperty[];
}

export interface UpdateEntityInput {
  category_id?: number;
  name?: string;
  description?: string | null;
  properties?: EntityProperty[];
}

/** List a work's worldbuilding categories with entry counts. */
export async function listCategories(workId: number): Promise<EntityCategory[]> {
  return requestJson<EntityCategory[]>(`/works/${workId}/categories`);
}

/** Create a custom worldbuilding category for a work. */
export async function createCategory(workId: number, name: string): Promise<EntityCategory> {
  return requestJson<EntityCategory>(`/works/${workId}/categories`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** Delete a custom category (and cascade its entries). */
export async function deleteCategory(categoryId: number): Promise<void> {
  await requestJson<void>(`/categories/${categoryId}`, { method: "DELETE" });
}

/** List distinct property names for a category, most frequent first. */
export async function listPropertyNames(categoryId: number): Promise<string[]> {
  return requestJson<string[]>(`/categories/${categoryId}/property-names`);
}

/** List a work's entries with optional category filter, search, and paging. */
export async function listEntities(
  workId: number,
  params: EntityListParams = {},
): Promise<WorldEntityListResponse> {
  const query = new URLSearchParams();
  if (params.categoryId != null) query.set("category_id", String(params.categoryId));
  if (params.search) query.set("search", params.search);
  if (params.sortBy) query.set("sort_by", params.sortBy);
  if (params.order) query.set("order", params.order);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("page_size", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<WorldEntityListResponse>(`/works/${workId}/entities${suffix}`);
}

/** Create a worldbuilding entry. */
export async function createEntity(
  workId: number,
  input: CreateEntityInput,
): Promise<WorldEntity> {
  return requestJson<WorldEntity>(`/works/${workId}/entities`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Partially update a worldbuilding entry. */
export async function updateEntity(
  entityId: number,
  input: UpdateEntityInput,
): Promise<WorldEntity> {
  return requestJson<WorldEntity>(`/entities/${entityId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Delete a worldbuilding entry by id. */
export async function deleteEntity(entityId: number): Promise<void> {
  await requestJson<void>(`/entities/${entityId}`, { method: "DELETE" });
}

export interface ChapterContent {
  id: number;
  work_id: number;
  chapter_number: number;
  title: string | null;
  summary: string | null;
  content: string | null;
  word_count: number;
  status: string;
}

export interface Recap {
  has_previous: boolean;
  previous_chapter_number: number | null;
  recap: string | null;
  cached: boolean;
  stale: boolean;
}

export interface RewriteResult {
  original: string;
  rewritten: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Load a chapter's full payload (including body text) for the editor. */
export async function getChapter(chapterId: number): Promise<ChapterContent> {
  return requestJson<ChapterContent>(`/chapters/${chapterId}`);
}

/** Save a chapter's body text (recomputes word counts server-side). */
export async function saveChapterContent(
  chapterId: number,
  content: string,
): Promise<ChapterContent> {
  return requestJson<ChapterContent>(`/chapters/${chapterId}/content`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

/** Generate the chapter body from its outline (optionally including the recap). */
export async function generateChapterDraft(
  chapterId: number,
  includeRecap = false,
): Promise<ChapterContent> {
  return requestJson<ChapterContent>(`/chapters/${chapterId}/draft:generate`, {
    method: "POST",
    body: JSON.stringify({ include_recap: includeRecap }),
  });
}

/** Look up the previous chapter's cached recap and whether it is stale. */
export async function getRecap(chapterId: number): Promise<Recap> {
  return requestJson<Recap>(`/chapters/${chapterId}/recap`);
}

/** Generate (and cache) the previous chapter's recap. */
export async function generateRecap(chapterId: number): Promise<Recap> {
  return requestJson<Recap>(`/chapters/${chapterId}/recap:generate`, { method: "POST" });
}

/** Rewrite a selected passage; returns original + new for a diff preview. */
export async function rewritePassage(
  chapterId: number,
  input: {
    selection: string;
    instruction?: string;
    context?: string;
    preceding?: string;
    following?: string;
  },
): Promise<RewriteResult> {
  return requestJson<RewriteResult>(`/chapters/${chapterId}/rewrite`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Send the writing-assistant chat conversation and get the assistant reply. */
export async function sendWritingChat(
  workId: number,
  input: { messages: ChatMessage[]; chapter_id?: number | null; quoted?: string | null },
): Promise<{ reply: string }> {
  return requestJson<{ reply: string }>(`/works/${workId}/chat`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type InspirationSourcePage = "outline" | "writing" | "review";

/** Source references for an inspiration, used later for "来源跳转". */
export interface InspirationSource {
  source_page?: InspirationSourcePage;
  work_id?: number | null;
  chapter_id?: number | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
}

export interface Inspiration {
  id: number;
  content: string;
  source_page: string | null;
  work_id: number | null;
  chapter_id: number | null;
  created_at: string;
  tags: Tag[];
}

export interface CreateInspirationInput extends InspirationSource {
  content: string;
}

export interface InspirationListParams {
  search?: string;
  sourcePage?: InspirationSourcePage;
  tagId?: number;
  limit?: number;
}

/** Save a snippet as an inspiration with optional source references (G3). */
export async function createInspiration(input: CreateInspirationInput): Promise<Inspiration> {
  return requestJson<Inspiration>("/inspirations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** List inspirations (newest first) with optional search, source, and tag filters. */
export async function listInspirations(
  params: InspirationListParams = {},
): Promise<Inspiration[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.sourcePage) query.set("source_page", params.sourcePage);
  if (params.tagId != null) query.set("tag_id", String(params.tagId));
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<Inspiration[]>(`/inspirations${suffix}`);
}

/** Delete an inspiration by id. */
export async function deleteInspiration(inspirationId: number): Promise<void> {
  await requestJson<void>(`/inspirations/${inspirationId}`, { method: "DELETE" });
}

/** Replace the full set of tags attached to an inspiration. */
export async function setInspirationTags(
  inspirationId: number,
  tagIds: number[],
): Promise<Inspiration> {
  return requestJson<Inspiration>(`/inspirations/${inspirationId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tag_ids: tagIds }),
  });
}

/** List all reusable tags (alphabetical by name). */
export async function listTags(): Promise<Tag[]> {
  return requestJson<Tag[]>("/tags");
}

/** Create a tag (or return the existing one with the same name). */
export async function createTag(name: string, color?: string | null): Promise<Tag> {
  return requestJson<Tag>("/tags", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

/** Delete a tag (removing it from all inspirations). */
export async function deleteTag(tagId: number): Promise<void> {
  await requestJson<void>(`/tags/${tagId}`, { method: "DELETE" });
}

/** Send the review-assistant chat conversation and get the assistant reply. */
export async function sendReviewChat(
  workId: number,
  input: { messages: ChatMessage[]; chapter_id?: number | null; quoted?: string | null },
): Promise<{ reply: string }> {
  return requestJson<{ reply: string }>(`/works/${workId}/review/chat`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
