/** Tests for presentational components: Breadcrumb and SaveStatus. */
import "../i18n";
import i18n from "../i18n";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Breadcrumb } from "../components/Breadcrumb";
import { SaveStatus } from "../components/SaveStatus";
import { LOCALE_STORAGE_KEY } from "../utils/locale";

describe("Breadcrumb", () => {
  it("renders all items with separators between them", () => {
    render(<Breadcrumb items={[{ label: "玄幻系列" }, { label: "斩龙记" }]} />);

    expect(screen.getByText("玄幻系列")).toBeInTheDocument();
    expect(screen.getByText("斩龙记")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
  });
});

describe("SaveStatus", () => {
  beforeEach(async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "zh");
    await i18n.changeLanguage("zh");
  });

  it("shows the saved label for the saved state", () => {
    render(<SaveStatus state="saved" />);
    expect(screen.getByText(i18n.t("common:saveStatus.saved"))).toBeInTheDocument();
  });

  it("shows the error label for the error state", () => {
    render(<SaveStatus state="error" />);
    expect(screen.getByText(i18n.t("common:saveStatus.error"))).toBeInTheDocument();
  });
});
