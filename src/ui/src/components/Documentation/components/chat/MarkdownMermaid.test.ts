/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MessageItem } from "../messages/MessageItem";
import type { TextMessage } from "./ChatTypes";
jest.mock("../CodeModal", () => ({
  CodeModal: () => null,
}));
jest.mock("../messages/ToolCallsList", () => ({
  ToolCallsList: () => null,
}));
jest.mock("./ChatUtils", () => ({
  copyToClipboard: jest.fn(async () => true),
  parseMessageForFiles: jest.fn((text: string) => [
    { type: "text", content: text },
  ]),
}));

type MockToken =
  | { type: "heading"; raw: string; depth: number; text: string }
  | { type: "space"; raw: string }
  | { type: "code"; raw: string; lang?: string; text: string };

jest.mock("marked", () => {
  class Renderer {
    code?: (code: string, language?: string) => string;
  }

  const parse = jest.fn((input: string) => {
    if (input.includes("# Flow")) {
      return "<h1>Flow</h1>";
    }

    if (input.includes("```typescript")) {
      return '<pre class="language-typescript"><code class="language-typescript">const answer: number = 42;</code></pre>';
    }

    return input
      .replace(/\n/g, " ")
      .trim();
  });

  const lexer = jest.fn((input: string): MockToken[] => {
    if (input.includes("```mermaid")) {
      return [
        { type: "heading", raw: "# Flow\n", depth: 1, text: "Flow" },
        { type: "space", raw: "\n" },
        {
          type: "code",
          raw: "```mermaid\ngraph TD\n  A[Start] --> B[Done]\n```\n",
          lang: "mermaid",
          text: "graph TD\n  A[Start] --> B[Done]",
        },
      ];
    }

    if (input.includes("```typescript")) {
      return [
        {
          type: "code",
          raw: "```typescript\nconst answer: number = 42;\n```\n",
          lang: "typescript",
          text: "const answer: number = 42;",
        },
      ];
    }

    return [{ type: "heading", raw: input, depth: 1, text: input }];
  });

  return {
    __esModule: true,
    Renderer,
    parse,
    lexer,
    setOptions: jest.fn(),
  };
});

jest.mock("../common/MermaidDiagram", () => ({
  MermaidDiagram: ({
    chart,
    className,
  }: {
    chart: string;
    className?: string;
  }) =>
    React.createElement(
      "div",
      {
        className,
        "data-testid": "mermaid-diagram",
      },
      chart
    ),
}));

describe("MessageItem markdown Mermaid support", () => {
  test("renders fenced mermaid blocks as Mermaid diagrams for bot messages", () => {
    const message: TextMessage = {
      id: "msg-1",
      author: "bot",
      type: "text",
      timestamp: Date.now(),
      text: [
        "# Flow",
        "",
        "```mermaid",
        "graph TD",
        "  A[Start] --> B[Done]",
        "```",
      ].join("\n"),
    };

    render(
      React.createElement(MessageItem, {
        message,
        onOpenFile: jest.fn(),
        onOpenDiff: jest.fn(),
      })
    );

    expect(screen.getByRole("heading", { name: "Flow" })).toBeTruthy();
    expect(screen.getByTestId("mermaid-diagram")).toHaveTextContent(
      "graph TD A[Start] --> B[Done]"
    );
    expect(screen.queryByText("```mermaid")).toBeNull();
  });

  test("shows a markdown copy footer only after the bot response is complete", async () => {
    const message: TextMessage = {
      id: "msg-2",
      author: "bot",
      type: "text",
      timestamp: Date.now(),
      text: "```typescript\nconst answer: number = 42;\n```",
    };

    const { rerender } = render(
      React.createElement(MessageItem, {
        message,
        isStreaming: true,
        onOpenFile: jest.fn(),
        onOpenDiff: jest.fn(),
      })
    );

    expect(screen.queryByRole("button", { name: /copy markdown response/i })).toBeNull();

    rerender(
      React.createElement(MessageItem, {
        message,
        isStreaming: false,
        onOpenFile: jest.fn(),
        onOpenDiff: jest.fn(),
      })
    );

    const copyButton = screen.getByRole("button", {
      name: /copy markdown response/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(copyButton).toHaveTextContent("Copied");
    });
  });
});
