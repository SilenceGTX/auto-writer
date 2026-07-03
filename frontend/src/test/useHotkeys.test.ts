/** Tests for the global hotkey hook and combo normalization. */
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { eventToCombo, useHotkeys } from "../hooks/useHotkeys";

describe("eventToCombo", () => {
  it("normalizes ctrl/meta to the mod token", () => {
    const event = new KeyboardEvent("keydown", { key: "S", ctrlKey: true });
    expect(eventToCombo(event)).toBe("mod+s");
  });

  it("includes shift and alt modifiers in order", () => {
    const event = new KeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true });
    expect(eventToCombo(event)).toBe("mod+shift+z");
  });
});

describe("useHotkeys", () => {
  it("invokes the handler for a matching combo", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "mod+s": handler }));

    fireEvent.keyDown(document, { key: "s", ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores combos without a registered handler", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "mod+s": handler }));

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });
});
