import { useState, useEffect } from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";
import {
  buildNamespaceTree,
  buildTypeFirstTree,
  filterTree,
  toggleNodeExpansion,
  TreeNode,
} from "../utils/tree-utils";
import { TreeType } from "./useViewMode";

function getExpansionStorageKey(treeType: TreeType): string {
  return treeType === "namespace"
    ? DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_NAMESPACE
    : DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_EXPANSION_TYPE;
}

function readExpandedNodeIds(treeType: TreeType): string[] {
  try {
    const raw = localStorage.getItem(getExpansionStorageKey(treeType));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function persistExpandedNodeIds(treeType: TreeType, nodeIds: string[]): void {
  try {
    localStorage.setItem(
      getExpansionStorageKey(treeType),
      JSON.stringify(Array.from(new Set(nodeIds)))
    );
  } catch {
    // Ignore localStorage errors
  }
}

function applyExpandedState(
  nodes: TreeNode[],
  expandedNodeIds: Set<string>
): TreeNode[] {
  return nodes.map((node) => ({
    ...node,
    isExpanded:
      node.children.length > 0 ? expandedNodeIds.has(node.id) : node.isExpanded,
    children: applyExpandedState(node.children, expandedNodeIds),
  }));
}

function collectExpandedNodeIds(nodes: TreeNode[]): string[] {
  const expandedIds: string[] = [];
  const visit = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.children.length > 0 && node.isExpanded) {
        expandedIds.push(node.id);
      }
      if (node.children.length > 0) {
        visit(node.children);
      }
    }
  };

  visit(nodes);
  return expandedIds;
}

export const useTreeNavigation = (
  allElements: any[],
  treeType: TreeType,
  localNamespaceSearch: string,
  introspector: Introspector,
  filteredData: {
    tasks: any[];
    resources: any[];
    events: any[];
    hooks: any[];
    middlewares: any[];
    tags: any[];
  }
) => {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  // Build tree data when elements or view mode changes
  useEffect(() => {
    let tree: TreeNode[];
    if (treeType === "namespace") {
      tree = buildNamespaceTree(allElements);
    } else {
      tree = buildTypeFirstTree(allElements);
    }

    // Apply search filter
    if (localNamespaceSearch) {
      tree = filterTree(tree, localNamespaceSearch);
    } else {
      tree = applyExpandedState(tree, new Set(readExpandedNodeIds(treeType)));
    }

    setTreeNodes(tree);
  }, [allElements, treeType, localNamespaceSearch]);

  const handleToggleExpansion = (nodeId: string, expanded?: boolean) => {
    setTreeNodes((prevNodes) => {
      const nextNodes = toggleNodeExpansion(prevNodes, nodeId, expanded);
      if (!localNamespaceSearch) {
        persistExpandedNodeIds(treeType, collectExpandedNodeIds(nextNodes));
      }
      return nextNodes;
    });
  };

  const handleTreeNodeClick = (node: TreeNode) => {
    if (!node.elementId) return;

    const anchorId = `element-${node.elementId}`;
    const targetHash = `#${anchorId}`;

    if (node.children.length > 0) {
      if (node.isExpanded && window.location.hash === targetHash) {
        handleToggleExpansion(node.id, false);
        return;
      }

      if (!node.isExpanded) {
        handleToggleExpansion(node.id, true);
      }
    }

    // If already at this hash, force scroll; otherwise update hash for instant navigation
    if (window.location.hash === targetHash) {
      document
        .getElementById(anchorId)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      window.location.hash = targetHash;
    }

    const target = document.getElementById(anchorId);
    if (target) {
      target.classList.add(
        DOCUMENTATION_CONSTANTS.CSS_CLASSES.HIGHLIGHT_TARGET
      );
      setTimeout(() => {
        target.classList.remove(
          DOCUMENTATION_CONSTANTS.CSS_CLASSES.HIGHLIGHT_TARGET
        );
      }, DOCUMENTATION_CONSTANTS.CONSTRAINTS.HIGHLIGHT_DURATION);
    }
  };

  // Handle hash changes to clear search when navigating to filtered-out elements
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#element-") && localNamespaceSearch) {
        const elementId = hash.substring(9); // Remove '#element-' prefix

        // Get all unfiltered elements
        const allUnfilteredElements = introspector.getAll();

        // Get all currently filtered (visible) elements
        const allFilteredElements = [
          ...filteredData.tasks,
          ...filteredData.resources,
          ...filteredData.events,
          ...filteredData.hooks,
          ...filteredData.middlewares,
          ...filteredData.tags,
        ];

        // Check if the target element exists in unfiltered but not in filtered
        const elementExistsUnfiltered = allUnfilteredElements.some(
          (el) => el.id === elementId
        );
        const elementExistsFiltered = allFilteredElements.some(
          (el) => el.id === elementId
        );

        if (elementExistsUnfiltered && !elementExistsFiltered) {
          // This would need to be handled by the parent component
          // Return a callback or use a context to update the search
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [localNamespaceSearch, filteredData, introspector]);

  return {
    treeNodes,
    handleTreeNodeClick,
    handleToggleExpansion,
  };
};
