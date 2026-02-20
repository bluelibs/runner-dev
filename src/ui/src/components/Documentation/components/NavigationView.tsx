import React, { useState, useEffect, useRef } from "react";
import { TreeNode, getElementType } from "../utils/tree-utils";
import "./NavigationView.scss";

export type NavigationMode = "list" | "tree";

export interface NavigationViewProps {
  mode: NavigationMode;
  nodes?: TreeNode[];
  sections?: Array<{
    id: string;
    label: string;
    icon: string;
    count: number | null;
    hasContent: boolean;
  }>;
  onNodeClick?: (node: TreeNode) => void;
  onSectionClick?: (sectionId: string) => void;
  onToggleExpansion?: (nodeId: string, expanded?: boolean) => void;
  resolveSectionFromElementId?: (elementId: string) => string | null;
  searchTerm?: string;
  className?: string;
}

export const NavigationView: React.FC<NavigationViewProps> = ({
  mode,
  nodes = [],
  sections = [],
  onNodeClick,
  onSectionClick,
  onToggleExpansion,
  resolveSectionFromElementId,
  searchTerm = "",
  className = "",
}) => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Sync the focused sidebar item with the URL hash so that navigating via
  // in-content links (e.g. clicking a resource from the Tasks view) also
  // updates the active state in the sidebar.
  useEffect(() => {
    const syncFocusToHash = () => {
      const hash = window.location.hash;

      if (!hash || hash === "#" || hash === "#top") {
        setFocusedNodeId("home");
        return;
      }

      if (hash.startsWith("#element-")) {
        const elementId = hash.substring(9); // strip "#element-"

        if (mode === "tree") {
          // In tree mode find the exact matching node
          const findNode = (nodeList: TreeNode[]): TreeNode | null => {
            for (const node of nodeList) {
              if (node.elementId === elementId || node.id === elementId) {
                return node;
              }
              const found = findNode(node.children);
              if (found) return found;
            }
            return null;
          };
          const matched = findNode(nodes);
          if (matched) setFocusedNodeId(matched.id);
        } else {
          const resolvedSectionId = resolveSectionFromElementId?.(elementId);
          if (
            resolvedSectionId &&
            sections.some((section) => section.id === resolvedSectionId)
          ) {
            setFocusedNodeId(resolvedSectionId);
            return;
          }

          // In list mode map the element's type to its parent section
          const TYPE_TO_SECTION: Record<string, string> = {
            task: "tasks",
            resource: "resources",
            event: "events",
            hook: "hooks",
            middleware: "middlewares",
            tag: "tags",
          };
          const type = getElementType({ id: elementId });
          const sectionId = TYPE_TO_SECTION[type];
          if (
            sectionId &&
            sections.some((section) => section.id === sectionId)
          ) {
            setFocusedNodeId(sectionId);
          }
        }
        return;
      }

      // Plain section hash like #tasks, #resources, #overview-stats …
      const sectionId = hash.substring(1);
      if (sectionId === "overview") {
        setFocusedNodeId("home");
      } else if (sections.some((s) => s.id === sectionId)) {
        setFocusedNodeId(sectionId);
      }
    };

    // Sync on mount and on every subsequent hash change
    syncFocusToHash();
    window.addEventListener("hashchange", syncFocusToHash);
    return () => window.removeEventListener("hashchange", syncFocusToHash);
  }, [mode, nodes, sections, resolveSectionFromElementId]);

  // Handle keyboard navigation for both modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedNodeId || !navRef.current?.contains(document.activeElement))
        return;

      if (mode === "tree") {
        handleTreeKeyDown(e);
      } else {
        handleListKeyDown(e);
      }
    };

    const handleTreeKeyDown = (e: KeyboardEvent) => {
      const allNodes = getAllNodesFlat(nodes);
      const currentIndex = allNodes.findIndex(
        (node) => node.id === focusedNodeId
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < allNodes.length - 1) {
            setFocusedNodeId(allNodes[currentIndex + 1].id);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            setFocusedNodeId(allNodes[currentIndex - 1].id);
          }
          break;
        case "ArrowRight": {
          e.preventDefault();
          const currentNode = allNodes[currentIndex];
          if (
            currentNode.type === "folder" &&
            !currentNode.isExpanded &&
            currentNode.children.length > 0
          ) {
            onToggleExpansion?.(currentNode.id, true);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const currentNodeLeft = allNodes[currentIndex];
          if (currentNodeLeft.type === "folder" && currentNodeLeft.isExpanded) {
            onToggleExpansion?.(currentNodeLeft.id, false);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const nodeToClick = allNodes[currentIndex];
          if (nodeToClick.type === "folder") {
            onToggleExpansion?.(nodeToClick.id);
          } else if (onNodeClick) {
            onNodeClick(nodeToClick);
          }
          break;
        }
      }
    };

    const handleListKeyDown = (e: KeyboardEvent) => {
      const allSections = ["home", ...sections.map((s) => s.id)];
      const currentIndex = allSections.findIndex(
        (sectionId) => sectionId === focusedNodeId
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < allSections.length - 1) {
            setFocusedNodeId(allSections[currentIndex + 1]);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            setFocusedNodeId(allSections[currentIndex - 1]);
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedNodeId && onSectionClick) {
            onSectionClick(focusedNodeId === "home" ? "top" : focusedNodeId);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedNodeId,
    nodes,
    sections,
    mode,
    onToggleExpansion,
    onNodeClick,
    onSectionClick,
  ]);

  const renderTreeMode = () => {
    const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
      const hasChildren = node.children.length > 0;
      const isFolder = node.type === "folder";
      const isFocused = focusedNodeId === node.id;

      const handleNodeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFocusedNodeId(node.id);

        if (isFolder) {
          onToggleExpansion?.(node.id);
        } else if (onNodeClick) {
          onNodeClick(node);
        }
      };

      const handleExpanderClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleExpansion?.(node.id);
      };

      return (
        <div key={node.id} className="nav-node-container">
          <div
            className={`nav-node ${isFocused ? "nav-node--focused" : ""} ${
              !isFolder ? "nav-node--leaf" : ""
            }`}
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
            onClick={handleNodeClick}
            tabIndex={0}
            role="treeitem"
            aria-expanded={isFolder ? node.isExpanded : undefined}
            aria-level={depth + 1}
            onFocus={() => setFocusedNodeId(node.id)}
          >
            {isFolder && hasChildren && (
              <button
                className={`nav-expander ${
                  node.isExpanded ? "nav-expander--expanded" : ""
                }`}
                onClick={handleExpanderClick}
                aria-label={node.isExpanded ? "Collapse" : "Expand"}
              >
                <span className="nav-expander-icon">▶</span>
              </button>
            )}
            {(!isFolder || !hasChildren) && (
              <span className="nav-expander nav-expander--placeholder" />
            )}

            <span className="nav-node-icon">{node.icon}</span>

            <span className="nav-node-label">
              {highlightSearchTerm(node.label, searchTerm)}
              {node.element?.tags?.includes("globals.tags.system") && (
                <span className="system-label">SYS</span>
              )}
            </span>

            {node.count !== undefined && (
              <span className="nav-node-count">{node.count}</span>
            )}
          </div>

          {isFolder && node.isExpanded && hasChildren && (
            <div className="nav-children" role="group">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div
        className="nav-tree-container"
        role="tree"
        aria-label="Documentation tree"
      >
        {nodes.map((node) => renderNode(node))}
      </div>
    );
  };

  const renderListMode = () => {
    const handleSectionClick = (sectionId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setFocusedNodeId(sectionId);
      if (onSectionClick) {
        onSectionClick(sectionId === "home" ? "top" : sectionId);
      }
    };

    return (
      <ul className="nav-list" role="list">
        <li>
          <a
            href="#top"
            className={`nav-link nav-link--home ${
              focusedNodeId === "home" ? "nav-link--focused" : ""
            }`}
            onClick={(e) => handleSectionClick("home", e)}
            onFocus={() => setFocusedNodeId("home")}
            tabIndex={0}
            role="listitem"
          >
            <div className="nav-content">
              <span className="icon">🏠</span>
              <span className="text">Home</span>
            </div>
          </a>
        </li>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={`nav-link ${
                focusedNodeId === section.id ? "nav-link--focused" : ""
              }`}
              onClick={(e) => handleSectionClick(section.id, e)}
              onFocus={() => setFocusedNodeId(section.id)}
              tabIndex={0}
              role="listitem"
            >
              <div className="nav-content">
                <span className="icon">{section.icon}</span>
                <span className="text">{section.label}</span>
              </div>
              {section.count !== null && (
                <span className="nav-badge">{section.count}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div
      ref={navRef}
      className={`navigation-view navigation-view--${mode} ${className}`}
      role={mode === "tree" ? "tree" : "navigation"}
    >
      {mode === "tree" ? renderTreeMode() : renderListMode()}
    </div>
  );
};

// Helper function to highlight search terms
function highlightSearchTerm(
  text: string,
  searchTerm: string
): React.ReactNode {
  if (!searchTerm.trim()) return text;

  const term = searchTerm.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(term);

  if (index === -1) return text;

  return (
    <>
      {text.substring(0, index)}
      <mark className="nav-search-highlight">
        {text.substring(index, index + term.length)}
      </mark>
      {text.substring(index + term.length)}
    </>
  );
}

// Helper function to get all nodes in a flat array (for keyboard navigation)
function getAllNodesFlat(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];

  const traverse = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      result.push(node);
      if (node.isExpanded && node.children.length > 0) {
        traverse(node.children);
      }
    }
  };

  traverse(nodes);
  return result;
}
