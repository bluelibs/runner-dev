import React from "react";
import * as marked from "marked";
import Prism from "prismjs";
import { MermaidDiagram } from "../components/common/MermaidDiagram";

// Import PrismJS languages
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-graphql";

// Import PrismJS CSS theme (One Dark theme)
import "prismjs/themes/prism-okaidia.css";
// Import custom PrismJS enhancements
import "./markdownUtils.scss";

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
};

function normalizeLanguage(language?: string): string | undefined {
  const value = language?.trim().toLowerCase();
  if (!value) return undefined;

  return LANGUAGE_ALIASES[value] || value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Configure custom renderer for code blocks
const renderer = new marked.Renderer();

renderer.code = (token) => {
  const code = token.text;
  const language = normalizeLanguage(token.lang);
  let highlighted = escapeHtml(code);

  if (language && Prism.languages[language]) {
    try {
      highlighted = Prism.highlight(code, Prism.languages[language], language);
    } catch (error) {
      console.warn(
        `Failed to highlight code with language "${language}":`,
        error
      );
    }
  }

  return `<pre class="language-${language || "text"}"><code class="language-${
    language || "text"
  }">${highlighted}</code></pre>`;
};

// Configure marked options for better code rendering
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true, // GitHub flavored markdown
  renderer: renderer,
});

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableMermaid?: boolean;
}

type MarkdownToken = ReturnType<typeof marked.lexer>[number];

type MarkdownSegment =
  | { type: "html"; html: string }
  | { type: "mermaid"; chart: string };

function isMermaidCodeToken(
  token: MarkdownToken
): token is MarkdownToken & { type: "code"; text: string; lang?: string } {
  return token.type === "code" && normalizeLanguage(token.lang) === "mermaid";
}

function buildMarkdownSegments(
  content: string,
  enableMermaid: boolean
): MarkdownSegment[] {
  if (!enableMermaid) {
    return [{ type: "html", html: marked.parse(content) as string }];
  }

  const tokens = marked.lexer(content);
  const segments: MarkdownSegment[] = [];
  let htmlBuffer = "";

  const flushHtmlBuffer = () => {
    if (!htmlBuffer) return;
    segments.push({
      type: "html",
      html: marked.parse(htmlBuffer) as string,
    });
    htmlBuffer = "";
  };

  for (const token of tokens) {
    if (isMermaidCodeToken(token)) {
      flushHtmlBuffer();
      segments.push({
        type: "mermaid",
        chart: token.text,
      });
      continue;
    }

    htmlBuffer += token.raw;
  }

  flushHtmlBuffer();

  return segments;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
  enableMermaid = false,
}) => {
  const segments = React.useMemo(() => {
    try {
      return buildMarkdownSegments(content, enableMermaid);
    } catch (error) {
      console.error("Error rendering markdown:", error);
      return [{ type: "html", html: content } satisfies MarkdownSegment];
    }
  }, [content, enableMermaid]);

  return (
    <div className={`markdown-content ${className}`}>
      {segments.map((segment, index) =>
        segment.type === "mermaid" ? (
          <MermaidDiagram
            key={`mermaid-${index}`}
            chart={segment.chart}
            className="markdown-content__mermaid"
          />
        ) : (
          <div
            key={`html-${index}`}
            dangerouslySetInnerHTML={{ __html: segment.html }}
          />
        )
      )}
    </div>
  );
};

// Hook for rendering markdown content
export const useMarkdown = (content: string): string | Promise<string> => {
  return React.useMemo(() => {
    try {
      return marked.parse(content);
    } catch (error) {
      console.error("Error processing markdown:", error);
      return content;
    }
  }, [content]);
};
