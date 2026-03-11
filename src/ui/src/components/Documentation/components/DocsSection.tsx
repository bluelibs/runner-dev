import React from "react";
import { DocsContentPayload } from "../../../../../resources/routeHandlers/getDocsData";
import { MarkdownRenderer } from "../utils/markdownUtils";

export interface DocsSectionProps {
  docsContent: DocsContentPayload;
  id?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

type DocsTabId = "minimal" | "complete";

type DocsTab = {
  id: DocsTabId;
  label: string;
  content: string;
};

export const DocsSection: React.FC<DocsSectionProps> = ({
  docsContent,
  id = "docs",
  title = "📚 Docs",
  description = "Generated Runner framework guides bundled with Runner Dev for quick in-app reference.",
  actions,
}) => {
  const tabs = React.useMemo<DocsTab[]>(() => {
    const nextTabs: DocsTab[] = [];

    if (docsContent.minimalMd) {
      nextTabs.push({
        id: "minimal",
        label: "Minimal",
        content: docsContent.minimalMd,
      });
    }

    if (docsContent.completeMd) {
      nextTabs.push({
        id: "complete",
        label: "Complete",
        content: docsContent.completeMd,
      });
    }

    return nextTabs;
  }, [docsContent]);

  const [activeTab, setActiveTab] = React.useState<DocsTabId>(
    tabs[0]?.id ?? "minimal"
  );

  React.useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "minimal");
    }
  }, [activeTab, tabs]);

  const activeTabContent =
    tabs.find((tab) => tab.id === activeTab) ?? tabs[0] ?? null;

  if (!activeTabContent) {
    return null;
  }

  return (
    <section id={id} className="docs-section docs-static-guides">
      <div className="docs-static-guides__header">
        <div className="docs-static-guides__intro">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? (
          <div className="docs-static-guides__actions">{actions}</div>
        ) : null}
      </div>

      <div
        className="docs-static-guides__tabs"
        role="tablist"
        aria-label="Documentation variants"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTabContent.id === tab.id}
            className={`docs-static-guides__tab ${
              activeTabContent.id === tab.id
                ? "docs-static-guides__tab--active"
                : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="docs-static-guides__content">
        <MarkdownRenderer
          content={activeTabContent.content}
          enableMermaid
          className="docs-static-guides__markdown"
        />
      </div>
    </section>
  );
};
