/** Tests for the Toast provider and useToast hook. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "../components/Toast";

function Trigger(): React.ReactElement {
  const { notify } = useToast();
  return (
    <button type="button" onClick={() => notify("已保存", "success")}>
      触发
    </button>
  );
}

describe("ToastProvider", () => {
  it("renders a toast message when notify is called", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByText("已保存")).toBeNull();
    await userEvent.click(screen.getByText("触发"));
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("throws when useToast is used outside the provider", () => {
    function Orphan(): React.ReactElement {
      useToast();
      return <div />;
    }
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
  });
});
