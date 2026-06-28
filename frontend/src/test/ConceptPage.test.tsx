/** Integration test for the worldbuilding page (tabs, cards, create form). */
import { useState, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityCategory, WorldEntity } from "../api";
import { AppProvider } from "../context/AppContext";
import { AssistantProvider } from "../context/AssistantContext";
import { AssistantPanel } from "../components/AssistantPanel";
import { ToastProvider } from "../components/Toast";
import { ConceptPage } from "../pages/ConceptPage";

const sampleCategories = vi.hoisted(
  () =>
    [
      { id: 1, work_id: 1, name: "人物", is_preset: 1, sort_order: 0, entity_count: 1 },
      { id: 2, work_id: 1, name: "地点", is_preset: 1, sort_order: 1, entity_count: 0 },
      { id: 3, work_id: 1, name: "组织", is_preset: 0, sort_order: 2, entity_count: 0 },
    ] as EntityCategory[],
);

const sampleEntities = vi.hoisted(
  () =>
    [
      {
        id: 10,
        work_id: 1,
        category_id: 1,
        name: "张三",
        description: "主角",
        properties: [{ name: "年龄", value: "24" }],
        sort_order: 1,
        created_at: "2026-01-01 00:00:00",
        updated_at: "2026-01-02 00:00:00",
      },
    ] as WorldEntity[],
);

vi.mock("../api", () => ({
  listCategories: vi.fn().mockResolvedValue(sampleCategories),
  listEntities: vi.fn().mockResolvedValue({ items: sampleEntities, total: 1 }),
  listPropertyNames: vi.fn().mockResolvedValue(["年龄", "身份"]),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
}));

/** Render ConceptPage together with the assistant panel that hosts its portal. */
function Harness(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <ConceptPage />
      <AssistantPanel collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
    </div>
  );
}

function renderPage() {
  localStorage.setItem("aw.currentWorkId", "1");
  return render(
    <MemoryRouter>
      <AppProvider>
        <AssistantProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </AssistantProvider>
      </AppProvider>
    </MemoryRouter>,
  );
}

describe("ConceptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders category tabs and entity cards", async () => {
    renderPage();
    expect(await screen.findByText("张三")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /人物/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /组织/ })).toBeInTheDocument();
    expect(screen.getByText("主角")).toBeInTheDocument();
  });

  it("opens the create form in the assistant panel", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("张三")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "新建条目" }));

    expect(await screen.findByRole("heading", { name: "新建条目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建条目" })).toBeInTheDocument();
  });

  it("exposes a delete control only for custom categories", async () => {
    renderPage();
    await screen.findByText("张三");

    expect(screen.queryByRole("button", { name: "删除种类 人物" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除种类 组织" })).toBeInTheDocument();
  });
});
