import React from "react";
import { marked } from "marked";
import Prism from "prismjs";

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

// Configure custom renderer for code blocks
const renderer = new marked.Renderer();

renderer.code = (code: string, language?: string) => {
  let highlighted = code;
  
  if (language && Prism.languages[language]) {
    try {
      highlighted = Prism.highlight(code, Prism.languages[language], language);
    } catch (error) {
      console.warn(`Failed to highlight code with language "${language}":`, error);
    }
  }
  
  return `<pre class="language-${language || 'text'}"><code class="language-${language || 'text'}">${highlighted}</code></pre>`;
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
