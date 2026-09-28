/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CodeModal } from "./CodeModal";
import { graphqlRequest } from "../utils/graphqlClient";

jest.mock("./CodeModal.scss", () => ({}), { virtual: true });

jest.mock("@uiw/react-codemirror", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
      editable,
    }: {
      value: string;
      onChange: (val: string) => void;
      editable: boolean;
    }) =>
      React.createElement("textarea", {
        "aria-label": "Source",
        value,
        readOnly: !editable,
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value),
      }),
  };
});

jest.mock("@codemirror/lang-javascript", () => ({
  javascript: () => ({}),
}));

jest.mock("@codemirror/theme-one-dark", () => ({
  oneDark: {},
}));

jest.mock("@codemirror/view", () => ({
  ViewPlugin: { fromClass: () => ({}) },
  Decoration: { line: () => ({}), set: () => ({}) },
  EditorView: { theme: () => ({}) },
}));

jest.mock("../utils/graphqlClient", () => ({
  ...jest.requireActual("../utils/graphqlClient"),
  graphqlRequest: jest.fn(),
}));

jest.mock("./chat/ChatUtils", () => ({
  copyToClipboard: jest.fn(async () => true),
}));

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
          { "data-testid": "code-dialog" },
          renderHeader?.({ onClose }),
          children
        )
      : null,
}));

const mockedRequest = graphqlRequest as unknown as jest.Mock;

function renderEditableModal() {
  render(
    React.createElement(CodeModal, {
      title: "task.ts",
      isOpen: true,
      onClose: () => {},
      code: "export const a = 1;",
      enableEdit: true,
      saveOnFile: "workspace:src/task.ts",
    })
  );
}

function sourceEditor(): HTMLTextAreaElement {
  return screen.getByLabelText("Source") as HTMLTextAreaElement;
}

describe("CodeModal editing gate", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("locks the editor and explains how to enable editing when the server gate is closed", async () => {
    mockedRequest.mockResolvedValueOnce({ codeExecutionEnabled: false });
    renderEditableModal();

    const note = await screen.findByRole("status");
    expect(note.textContent).toBe(
      "Editing is disabled on this server. Start it with RUNNER_DEV_EVAL=1 or NODE_ENV=development to enable it."
    );
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.stringContaining("codeExecutionEnabled")
    );
    expect(sourceEditor().readOnly).toBe(true);

    fireEvent.change(sourceEditor(), { target: { value: "changed" } });
    expect(screen.queryByText("SAVE")).toBeNull();
  });

  it("saves through editFile when the server gate is open", async () => {
    mockedRequest.mockResolvedValueOnce({ codeExecutionEnabled: true });
    mockedRequest.mockResolvedValueOnce({
      editFile: { success: true, error: null },
    });
    renderEditableModal();

    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.change(sourceEditor(), { target: { value: "changed" } });
    fireEvent.click(screen.getByText("SAVE"));

    await waitFor(() =>
      expect(mockedRequest).toHaveBeenLastCalledWith(
        expect.stringContaining("editFile"),
        { path: "workspace:src/task.ts", content: "changed" }
      )
    );
    await waitFor(() => expect(screen.queryByText("SAVE")).toBeNull());
  });

  it("stays editable when the gate probe fails and shows the save error", async () => {
    mockedRequest.mockRejectedValueOnce(new Error("offline"));
    mockedRequest.mockResolvedValueOnce({
      editFile: {
        success: false,
        error: "File editing is disabled in this environment.",
      },
    });
    renderEditableModal();

    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
    expect(sourceEditor().readOnly).toBe(false);
    fireEvent.change(sourceEditor(), { target: { value: "changed" } });
    fireEvent.click(screen.getByText("SAVE"));

    expect(
      await screen.findByText("File editing is disabled in this environment.")
    ).toBeTruthy();
  });

  it("never probes the gate for read-only viewers", () => {
    render(
      React.createElement(CodeModal, {
        title: "readme",
        isOpen: true,
        onClose: () => {},
        code: "text",
      })
    );
    expect(mockedRequest).not.toHaveBeenCalled();
    expect(sourceEditor().readOnly).toBe(true);
  });
});
