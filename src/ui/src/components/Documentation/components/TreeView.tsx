import React, { useState, useEffect, useRef } from "react";
import { TreeNode } from "../utils/tree-utils";
import "./TreeView.scss";

export interface TreeViewProps {
  nodes: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  onToggleExpansion: (nodeId: string, expanded?: boolean) => void;
  searchTerm?: string;
  className?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({
  nodes,
  onNodeClick,
  onToggleExpansion,
  searchTerm = "",
  className = "",
}) => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedNodeId || !treeRef.current?.contains(document.activeElement))
        return;

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
        case "ArrowRight":
          e.preventDefault();
          const currentNode = allNodes[currentIndex];
          if (
            currentNode.type === "folder" &&
            !currentNode.isExpanded &&
            currentNode.children.length > 0
          ) {
            onToggleExpansion(currentNode.id, true);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          const currentNodeLeft = allNodes[currentIndex];
          if (currentNodeLeft.type === "folder" && currentNodeLeft.isExpanded) {
            onToggleExpansion(currentNodeLeft.id, false);
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          const nodeToClick = allNodes[currentIndex];
          if (nodeToClick.type === "folder") {
            onToggleExpansion(nodeToClick.id);
          } else if (onNodeClick) {
            onNodeClick(nodeToClick);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedNodeId, nodes, onToggleExpansion, onNodeClick]);

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isFolder = node.type === "folder";
    const isFocused = focusedNodeId === node.id;

    const handleNodeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setFocusedNodeId(node.id);

      if (isFolder) {
        onToggleExpansion(node.id);
      } else if (onNodeClick) {
        onNodeClick(node);
      }
    };

    const handleExpanderClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpansion(node.id);
    };

    return (
      <div key={node.id} className="tree-node-container">
        <div
          className={`tree-node ${isFocused ? "tree-node--focused" : ""} ${
            !isFolder ? "tree-node--leaf" : ""
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
              className={`tree-expander ${
                node.isExpanded ? "tree-expander--expanded" : ""
              }`}
              onClick={handleExpanderClick}
              aria-label={node.isExpanded ? "Collapse" : "Expand"}
            >
              <span className="tree-expander-icon">▶</span>
            </button>
          )}
          {(!isFolder || !hasChildren) && (
            <span className="tree-expander tree-expander--placeholder" />
          )}

          <span className="tree-node-icon">{node.icon}</span>

          <span className="tree-node-label">
            {highlightSearchTerm(node.label, searchTerm)}
          </span>

          {node.count !== undefined && (
            <span className="tree-node-count">{node.count}</span>
          )}
        </div>

        {isFolder && node.isExpanded && hasChildren && (
          <div className="tree-children" role="group">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={treeRef}
      className={`tree-view ${className}`}
      role="tree"
      aria-label="Documentation tree"
    >
      {nodes.map((node) => renderNode(node))}
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
      <mark className="tree-search-highlight">
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
