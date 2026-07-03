/** Tests for presentational components: Breadcrumb and SaveStatus. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "../components/Breadcrumb";
import { SaveStatus } from "../components/SaveStatus";

describe("Breadcrumb", () => {
  it("renders all items with separators between them", () => {
    render(<Breadcrumb items={[{ label: "玄幻系列" }, { label: "斩龙记" }]} />);

    expect(screen.getByText("玄幻系列")).toBeInTheDocument();
    expect(screen.getByText("斩龙记")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });
});

describe("SaveStatus", () => {
  it("shows the saved label for the saved state", () => {
    render(<SaveStatus state="saved" />);
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("shows the error label for the error state", () => {
    render(<SaveStatus state="error" />);
    expect(screen.getByText("保存失败")).toBeInTheDocument();
  });
});
