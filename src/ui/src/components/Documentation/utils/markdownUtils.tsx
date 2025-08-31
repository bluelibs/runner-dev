import React from "react";
import { marked } from "marked";

// Configure marked options for better code rendering
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true, // GitHub flavored markdown
});

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  const htmlContent = React.useMemo(() => {
    try {
      return marked(content);
    } catch (error) {
      console.error("Error rendering markdown:", error);
      return content; // Fallback to plain text
    }
  }, [content]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

// Hook for rendering markdown content
export const useMarkdown = (content: string): string | Promise<string> => {
  return React.useMemo(() => {
    try {
      return marked(content);
    } catch (error) {
      console.error("Error processing markdown:", error);
      return content;
    }
  }, [content]);
};
