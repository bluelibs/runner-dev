/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ShellModal } from "./ShellModal";
import { graphqlRequest } from "../utils/graphqlClient";

jest.mock("./ShellModal.scss", () => ({}), { virtual: true });

jest.mock("@uiw/react-codemirror", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react") as typeof import("react");
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        {
          value,
          onChange,
        }: {
          value: string;
          onChange: (val: string) => void;
        },
        ref: { current: unknown } | null
      ) => {
        if (ref) {
          ref.current = { view: { mockedEditorView: true } };
        }
        return React.createElement(
          "div",
          { className: "shell-modal__editor" },
          React.createElement("textarea", {
            "aria-label": "Shell input",
            value,
            onChange: (e: { target: { value: string } }) =>
              onChange(e.target.value),
          }),
          React.createElement("div", {
            className: "cm-content",
            tabIndex: -1,
          })
        );
      }
    ),
  };
});

jest.mock("@codemirror/lang-javascript", () => ({
  javascript: () => ({}),
  localCompletionSource: () => null,
  snippets: () => null,
}));

jest.mock("@codemirror/autocomplete", () => ({
  autocompletion: () => ({}),
  acceptCompletion: jest.fn(() => true),
}));

jest.mock("../utils/shellCompletion", () => ({
  createShellCompletionSource: () => () => null,
}));

jest.mock("@codemirror/theme-one-dark", () => ({
  oneDark: {},
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
          { "data-testid": "shell-dialog" },
          renderHeader?.({ onClose }),
          children
        )
      : null,
}));

const mockedRequest = graphqlRequest as unknown as jest.Mock;

function shellResponse(overrides: Record<string, unknown> = {}) {
  return {
    shell: {
      success: true,
      error: null,
      result: "3",
      logs: [],
      executionTimeMs: 12,
      invocationId: "inv-1",
      ...overrides,
    },
  };
}

function renderShell(resourceId: string | null) {
  render(
    React.createElement(ShellModal, {
      isOpen: true,
      onClose: () => {},
      resourceId,
    })
  );
}

describe("ShellModal", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("renders nothing when closed", () => {
    render(
      React.createElement(ShellModal, {
        isOpen: false,
        onClose: () => {},
        resourceId: "app.db",
      })
    );
    expect(screen.queryByTestId("shell-dialog")).toBeNull();
  });

  it("shows resource scope and empty state", () => {
    renderShell("app.db");
    expect(screen.getByText("Shell — app.db")).toBeTruthy();
    expect(screen.getByText("r: app.db")).toBeTruthy();
    expect(screen.getByText("runtime")).toBeTruthy();
    expect(screen.getByText(/r is the live value of app\.db/)).toBeTruthy();
  });

  it("shows runtime scope without a resource", () => {
    renderShell(null);
    expect(screen.getByText("Shell — Runtime")).toBeTruthy();
    expect(screen.getByText("r: null")).toBeTruthy();
    expect(screen.getByText(/runtime is the live Runner runtime/)).toBeTruthy();
  });

  it("inserts example snippets into the editor", () => {
    renderShell("app.db");
    fireEvent.click(screen.getByText("Object.keys(r ?? {})"));
    expect(
      (screen.getByLabelText("Shell input") as HTMLTextAreaElement).value
    ).toBe("Object.keys(r ?? {})");
  });

  it("runs a snippet and appends the result to the transcript", async () => {
    mockedRequest.mockResolvedValueOnce(shellResponse());
    renderShell("app.db");

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "1 + 2" },
    });
    fireEvent.click(screen.getByTitle("Run snippet (Enter)"));

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.stringContaining("mutation Shell"),
      { code: "1 + 2", resourceId: "app.db" }
    );
    expect(
      (screen.getByLabelText("Shell input") as HTMLTextAreaElement).value
    ).toBe("");

    await screen.findByText("3");
    expect(screen.getByText(/12ms/)).toBeTruthy();
  });

  it("renders errors and restores snippets", async () => {
    mockedRequest.mockResolvedValueOnce(
      shellResponse({ success: false, error: "boom", result: null })
    );
    renderShell(null);

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "throw 1" },
    });
    fireEvent.click(screen.getByTitle("Run snippet (Enter)"));

    await screen.findByText("boom");

    fireEvent.click(screen.getByText("Restore"));
    expect(
      (screen.getByLabelText("Shell input") as HTMLTextAreaElement).value
    ).toBe("throw 1");

    fireEvent.click(screen.getByText("Clear"));
    expect(screen.queryByText("boom")).toBeNull();
  });

  it("shows captured console logs above the result", async () => {
    mockedRequest.mockResolvedValueOnce(
      shellResponse({ result: "done", logs: ["hi 42"] })
    );
    renderShell(null);

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "console.log(1)" },
    });
    fireEvent.click(screen.getByTitle("Run snippet (Enter)"));

    await screen.findByText("done");
    expect(screen.getByText("hi 42")).toBeTruthy();
  });

  it("surfaces transport errors as entries", async () => {
    mockedRequest.mockRejectedValueOnce(new Error("network down"));
    renderShell(null);

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTitle("Run snippet (Enter)"));

    await screen.findByText("network down");
  });

  it("runs on Ctrl+Enter and ignores empty snippets", async () => {
    mockedRequest.mockResolvedValueOnce(shellResponse());
    renderShell(null);

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(mockedRequest).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "40 + 2" },
    });
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  });

  it("runs on Enter inside the editor", async () => {
    mockedRequest.mockResolvedValueOnce(shellResponse());
    renderShell(null);

    const input = screen.getByLabelText("Shell input");
    fireEvent.change(input, { target: { value: "1 + 1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.stringContaining("mutation Shell"),
      { code: "1 + 1", resourceId: null }
    );
  });

  it("runs on Enter even with a completion open", async () => {
    mockedRequest.mockResolvedValueOnce(shellResponse());
    renderShell(null);

    const input = screen.getByLabelText("Shell input");
    fireEvent.change(input, { target: { value: "runtime.state" } });
    const tooltip = document.createElement("div");
    tooltip.className = "cm-tooltip-autocomplete";
    input.parentElement?.appendChild(tooltip);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockedRequest).toHaveBeenCalledTimes(1));
  });

  it("accepts an open completion on Tab", () => {
    const { acceptCompletion } = jest.requireMock(
      "@codemirror/autocomplete"
    ) as { acceptCompletion: jest.Mock };
    acceptCompletion.mockClear();
    renderShell(null);

    const input = screen.getByLabelText("Shell input");
    fireEvent.change(input, { target: { value: "runtime.run" } });
    const tooltip = document.createElement("div");
    tooltip.className = "cm-tooltip-autocomplete";
    input.parentElement?.appendChild(tooltip);

    fireEvent.keyDown(input, { key: "Tab" });
    expect(acceptCompletion).toHaveBeenCalledTimes(1);
    expect(mockedRequest).not.toHaveBeenCalled();

    tooltip.remove();
    fireEvent.keyDown(input, { key: "Tab" });
    expect(acceptCompletion).toHaveBeenCalledTimes(1);
  });

  it("focuses the editor input on open", async () => {
    renderShell(null);
    await waitFor(() =>
      expect(document.activeElement?.className).toBe("cm-content")
    );
  });

  it("ignores Shift+Enter and Enter outside the editor", () => {
    renderShell(null);

    const input = screen.getByLabelText("Shell input");
    fireEvent.change(input, { target: { value: "1 + 1" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mockedRequest).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Enter" });
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("disables Run while the editor is empty", () => {
    renderShell(null);
    expect(
      (screen.getByTitle("Run snippet (Enter)") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("copies entry output to the clipboard", async () => {
    const { copyToClipboard } = jest.requireMock("./chat/ChatUtils") as {
      copyToClipboard: jest.Mock;
    };
    mockedRequest.mockResolvedValueOnce(shellResponse({ result: "copy-me" }));
    renderShell(null);

    fireEvent.change(screen.getByLabelText("Shell input"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByTitle("Run snippet (Enter)"));
    await screen.findByText("copy-me");

    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith("copy-me")
    );
  });
});
