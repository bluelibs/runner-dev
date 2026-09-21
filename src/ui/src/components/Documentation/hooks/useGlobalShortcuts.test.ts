/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import {
  useGlobalShortcuts,
  type GlobalShortcutHandlers,
} from "./useGlobalShortcuts";

function TestHost({ handlers }: { handlers: GlobalShortcutHandlers }) {
  useGlobalShortcuts(handlers);
  return React.createElement(
    "div",
    null,
    React.createElement("input", { "aria-label": "probe-input" }),
    React.createElement(
      "div",
      { className: "cm-editor" },
      React.createElement("div", {
        className: "cm-content",
        "aria-label": "probe-editor",
      })
    )
  );
}

function createHandlers(
  overrides: Partial<GlobalShortcutHandlers> = {}
): GlobalShortcutHandlers & Record<string, jest.Mock> {
  return {
    onOpenPalette: jest.fn(),
    onOpenShell: jest.fn(),
    onOpenShortcuts: jest.fn(),
    onNavigateSection: jest.fn(),
    onEscape: jest.fn(() => false),
    isOverlayOpen: jest.fn(() => false),
    ...overrides,
  } as GlobalShortcutHandlers & Record<string, jest.Mock>;
}

function renderHost(handlers: GlobalShortcutHandlers) {
  return render(React.createElement(TestHost, { handlers }));
}

describe("useGlobalShortcuts", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("toggles the palette on Cmd/Ctrl+K, even while typing", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount } = renderHost(handlers);
    const input = getByLabelText("probe-input");

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    fireEvent.keyDown(document, { key: "K", ctrlKey: true });
    fireEvent.keyDown(input, { key: "k", metaKey: true });
    expect(handlers.onOpenPalette).toHaveBeenCalledTimes(3);
    unmount();
  });

  test("opens the shell on Ctrl+` except while typing", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount } = renderHost(handlers);
    const input = getByLabelText("probe-input");

    fireEvent.keyDown(document, { key: "`", ctrlKey: true });
    expect(handlers.onOpenShell).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: "`", ctrlKey: true });
    expect(handlers.onOpenShell).toHaveBeenCalledTimes(1);
    unmount();
  });

  test("keys inside the shell editor are never hijacked", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount } = renderHost(handlers);
    const editor = getByLabelText("probe-editor");
    fireEvent.keyDown(editor, { key: "?" });
    fireEvent.keyDown(editor, { key: "g" });
    fireEvent.keyDown(editor, { key: "r" });
    expect(handlers.onOpenShortcuts).not.toHaveBeenCalled();
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    unmount();
  });

  test("Escape is ignored while an overlay is open", () => {
    const handlers = createHandlers({
      isOverlayOpen: jest.fn(() => true),
    });
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handlers.onEscape).not.toHaveBeenCalled();
    unmount();
  });

  test("Escape while typing only blurs the field", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount } = renderHost(handlers);
    const input = getByLabelText("probe-input") as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(handlers.onEscape).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
    unmount();
  });

  test("Escape delegates to onEscape and stops propagation when consumed", () => {
    const handlers = createHandlers({
      onEscape: jest.fn(() => true),
    });
    const { unmount } = renderHost(handlers);
    const bubbleListener = jest.fn();
    document.addEventListener("keydown", bubbleListener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
    expect(bubbleListener).not.toHaveBeenCalled();
    document.removeEventListener("keydown", bubbleListener);
    unmount();
  });

  test("Escape without consumption lets the event continue", () => {
    const handlers = createHandlers({
      onEscape: jest.fn(() => false),
    });
    const { unmount } = renderHost(handlers);
    const bubbleListener = jest.fn();
    document.addEventListener("keydown", bubbleListener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(bubbleListener).toHaveBeenCalledTimes(1);
    document.removeEventListener("keydown", bubbleListener);
    unmount();
  });

  test("single-key shortcut opens help", () => {
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "?" });
    expect(handlers.onOpenShortcuts).toHaveBeenCalledTimes(1);
    unmount();
  });

  test("single keys are ignored while typing, overlaid, or modified", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount, rerender } = renderHost(handlers);
    const input = getByLabelText("probe-input");

    fireEvent.keyDown(input, { key: "?" });
    fireEvent.keyDown(document, { key: "?", metaKey: true });
    fireEvent.keyDown(document, { key: "?", altKey: true });
    fireEvent.keyDown(document, { key: "g", ctrlKey: true });
    expect(handlers.onOpenShortcuts).not.toHaveBeenCalled();

    rerender(
      React.createElement(TestHost, {
        handlers: createHandlers({
          ...handlers,
          isOverlayOpen: jest.fn(() => true),
        }),
      })
    );
    fireEvent.keyDown(document, { key: "?" });
    expect(handlers.onOpenShortcuts).not.toHaveBeenCalled();
    unmount();
  });

  test("g followed by a section key navigates", () => {
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "g" });
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).toHaveBeenCalledWith("resources");
    unmount();
  });

  test("g followed by an unknown key navigates nowhere", () => {
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "g" });
    fireEvent.keyDown(document, { key: "z" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    unmount();
  });

  test("pressing g twice completes (and clears) the pending window", () => {
    jest.useFakeTimers();
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "g" });
    fireEvent.keyDown(document, { key: "g" });
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    unmount();
  });

  test("the pending g key expires after its timeout", () => {
    jest.useFakeTimers();
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "g" });
    jest.advanceTimersByTime(1600);
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    unmount();
  });

  test("overlay or typing clears a pending g key", () => {
    const handlers = createHandlers();
    const { getByLabelText, unmount, rerender } = renderHost(handlers);
    const input = getByLabelText("probe-input");

    fireEvent.keyDown(document, { key: "g" });
    fireEvent.keyDown(input, { key: "x" });
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "g" });
    rerender(
      React.createElement(TestHost, {
        handlers: createHandlers({
          ...handlers,
          isOverlayOpen: jest.fn(() => true),
        }),
      })
    );
    fireEvent.keyDown(document, { key: "x" });
    rerender(React.createElement(TestHost, { handlers }));
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    unmount();
  });

  test("unmounting removes the listener and pending timer", () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(window, "clearTimeout");
    const handlers = createHandlers();
    const { unmount } = renderHost(handlers);
    fireEvent.keyDown(document, { key: "g" });
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "r" });
    expect(handlers.onNavigateSection).not.toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
