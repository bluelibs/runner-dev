/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";
import { buildPaletteEntries } from "../utils/commandPalette";

jest.mock("./CommandPalette.scss", () => ({}), { virtual: true });

jest.mock("./modals", () => ({
  BaseModal: ({
    isOpen,
    children,
    renderHeader,
    onClose,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    renderHeader?: (props: { onClose: () => void }) => React.ReactNode;
    onClose: () => void;
  }) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "palette-dialog" },
          renderHeader?.({ onClose }),
          children
        )
      : null,
}));

const entries = buildPaletteEntries({
  elements: [
    { id: "runner.logger", kind: "resource", title: "Logger" },
    { id: "app.tasks.sync", kind: "task", title: "Sync" },
    { id: "plain.id", kind: "event" },
  ],
  sections: [{ id: "resources", label: "Resources", icon: "resource" }],
  actions: [
    {
      id: "open-shell",
      label: "Open shell",
      icon: "terminal",
      shortcut: "⌃`",
    },
    { id: "no-shortcut", label: "Plain action", icon: "check" },
  ],
});

function renderPalette(overrides: Record<string, unknown> = {}) {
  const onClose = jest.fn();
  const onSelectEntry = jest.fn();
  render(
    React.createElement(CommandPalette, {
      isOpen: true,
      onClose,
      entries,
      onSelectEntry,
      ...overrides,
    })
  );
  return { onClose, onSelectEntry };
}

describe("CommandPalette", () => {
  let rafSpy: jest.SpyInstance;

  beforeEach(() => {
    rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => {
    rafSpy.mockRestore();
  });

  test("renders nothing when closed", () => {
    renderPalette({ isOpen: false });
    expect(screen.queryByLabelText("Search commands and elements")).toBeNull();
  });

  test("shows grouped entries and focuses the input", () => {
    renderPalette();
    expect(screen.getByText("Sections")).toBeTruthy();
    expect(screen.getByText("Actions")).toBeTruthy();
    expect(screen.getByText("Elements")).toBeTruthy();
    expect(screen.getByText("Go to Resources")).toBeTruthy();
    expect(screen.getByText("Logger")).toBeTruthy();
    expect(screen.getByText("runner.logger")).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Search commands and elements"
    );
  });

  test("filters entries by query and shows an empty state", () => {
    renderPalette();
    const input = screen.getByLabelText(
      "Search commands and elements"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sync" } });
    expect(screen.getByText("Sync")).toBeTruthy();
    expect(screen.queryByText("Logger")).toBeNull();

    fireEvent.change(input, { target: { value: "nothing-matches-this" } });
    expect(screen.getByText(/No matches for/)).toBeTruthy();
  });

  test("clear button resets the query", () => {
    renderPalette();
    const input = screen.getByLabelText(
      "Search commands and elements"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sync" } });
    expect(screen.queryByText("Logger")).toBeNull();
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(screen.getByText("Logger")).toBeTruthy();
  });

  test("Enter runs the active entry", () => {
    const { onSelectEntry, onClose } = renderPalette();
    const input = screen.getByLabelText("Search commands and elements");
    fireEvent.change(input, { target: { value: "sync" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelectEntry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "element", id: "app.tasks.sync" })
    );
    expect(onClose).toHaveBeenCalled();
  });

  test("arrow keys move the active entry with wraparound", () => {
    renderPalette();
    const input = screen.getByLabelText("Search commands and elements");
    const options = () =>
      Array.from(
        document.querySelectorAll(
          ".command-palette__item"
        ) as unknown as HTMLElement[]
      );
    expect(options()[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options()[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options()[options().length - 1].getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  test("arrow keys are safe with no matches", () => {
    renderPalette();
    const input = screen.getByLabelText("Search commands and elements");
    fireEvent.change(input, { target: { value: "nothing-matches-this" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "a" });
    expect(screen.getByText(/No matches for/)).toBeTruthy();
  });

  test("hovering an item activates it and clicking runs it", () => {
    const { onSelectEntry, onClose } = renderPalette();
    const items = Array.from(
      document.querySelectorAll(
        ".command-palette__item"
      ) as unknown as HTMLElement[]
    );
    fireEvent.mouseMove(items[2]);
    expect(items[2].getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseMove(items[2]);
    fireEvent.click(items[2]);
    expect(onSelectEntry).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
