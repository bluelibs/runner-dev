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
    }

    setTreeNodes(tree);
  }, [allElements, treeType, localNamespaceSearch]);

  const handleTreeNodeClick = (node: TreeNode) => {
    if (!node.elementId) return;

    const anchorId = `element-${node.elementId}`;

    // If already at this hash, force scroll; otherwise update hash for instant navigation
    if (window.location.hash === `#${anchorId}`) {
      document
        .getElementById(anchorId)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    } else {
      window.location.hash = `#${anchorId}`;
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

  const handleToggleExpansion = (nodeId: string, expanded?: boolean) => {
    setTreeNodes((prevNodes) =>
      toggleNodeExpansion(prevNodes, nodeId, expanded)
    );
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
