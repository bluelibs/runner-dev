/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ShortcutsModal } from "./ShortcutsModal";

jest.mock("./ShortcutsModal.scss", () => ({}), { virtual: true });

jest.mock("./modals", () => ({
  BaseModal: ({
    isOpen,
    children,
    title,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    title?: string;
  }) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "shortcuts-dialog" },
          title ? React.createElement("h3", null, title) : null,
          children
        )
      : null,
}));

const sections = [
  { id: "overview", label: "Overview" },
  { id: "resources", label: "Resources" },
  { id: "mystery", label: "Mystery" },
];

function renderModal(overrides: Record<string, unknown> = {}) {
  render(
    React.createElement(ShortcutsModal, {
      isOpen: true,
      onClose: () => {},
      sections,
      shellAvailable: true,
      ...overrides,
    })
  );
}

describe("ShortcutsModal", () => {
  test("renders nothing when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText("Keyboard shortcuts")).toBeNull();
  });

  test("lists general shortcuts including the shell row", () => {
    renderModal();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Open command palette")).toBeTruthy();
    expect(screen.getByText("Open runtime shell")).toBeTruthy();
    expect(screen.getByText("Show this help")).toBeTruthy();
  });

  test("hides the shell row when the shell is unavailable", () => {
    renderModal({ shellAvailable: false });
    expect(screen.queryByText("Open runtime shell")).toBeNull();
    expect(screen.getByText("Open command palette")).toBeTruthy();
  });

  test("lists section jumps only for known shortcut keys", () => {
    renderModal();
    expect(screen.getByText("Go to Overview")).toBeTruthy();
    expect(screen.getByText("Go to Resources")).toBeTruthy();
    expect(screen.queryByText("Go to Mystery")).toBeNull();
  });

  test("omits the jumps group when no section has a shortcut", () => {
    renderModal({
      sections: [{ id: "mystery", label: "Mystery" }],
    });
    expect(screen.queryByText("Go to section")).toBeNull();
    expect(screen.getByText("General")).toBeTruthy();
  });
});
