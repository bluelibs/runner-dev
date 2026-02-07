import React from "react";

type MermaidRenderResult = { svg: string } | string;

type MermaidLike = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<MermaidRenderResult>;
};

const MERMAID_CONFIG: Record<string, unknown> = {
  startOnLoad: false,
  securityLevel: "loose",
  flowchart: {
    htmlLabels: true,
    useMaxWidth: true,
  },
  themeVariables: {
    fontSize: "14px",
    fontFamily:
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

declare global {
  interface Window {
    mermaid?: MermaidLike;
    __runnerDocsMermaidPromise?: Promise<MermaidLike>;
    __runnerDocsMermaidInitialized?: boolean;
  }
}

function loadMermaid(): Promise<MermaidLike> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mermaid can only be loaded in a browser"));
  }

  if (window.mermaid) {
    if (!window.__runnerDocsMermaidInitialized) {
      window.mermaid.initialize(MERMAID_CONFIG);
      window.__runnerDocsMermaidInitialized = true;
    }
    return Promise.resolve(window.mermaid);
  }

  if (window.__runnerDocsMermaidPromise) {
    return window.__runnerDocsMermaidPromise;
  }

  window.__runnerDocsMermaidPromise = new Promise<MermaidLike>(
    (resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      script.async = true;

      script.onload = () => {
        if (!window.mermaid) {
          reject(new Error("Mermaid script loaded but global was not found"));
          return;
        }

        window.mermaid.initialize(MERMAID_CONFIG);
        window.__runnerDocsMermaidInitialized = true;
        resolve(window.mermaid);
      };

      script.onerror = () => {
        reject(new Error("Failed to load Mermaid script"));
      };

      document.head.appendChild(script);
    }
  );

  return window.__runnerDocsMermaidPromise;
}

export interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  className,
}) => {
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");
  const uidRef = React.useRef(
    `runner-mermaid-${Math.random().toString(36).slice(2, 10)}`
  );

  React.useEffect(() => {
    let active = true;

    async function renderChart() {
      setError("");
      setSvg("");

      try {
        const mermaid = await loadMermaid();
        const renderId = `${uidRef.current}-${Date.now()}`;
        const result = await mermaid.render(renderId, chart);
        const svgContent = typeof result === "string" ? result : result.svg;

        if (active) {
          setSvg(svgContent);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to render Mermaid");
        }
      }
    }

    void renderChart();

    return () => {
      active = false;
    };
  }, [chart]);

  if (error) {
    return (
      <pre className={className}>
        {chart}
        {"\n\n"}
        Render error: {error}
      </pre>
    );
  }

  if (!svg) {
    return <div className={className}>Rendering diagram...</div>;
  }

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />
  );
};
