import { useState } from "react";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";

export type ViewMode = "list" | "tree";
export type TreeType = "namespace" | "type";

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (
        (localStorage.getItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.VIEW_MODE
        ) as ViewMode) || DOCUMENTATION_CONSTANTS.DEFAULTS.VIEW_MODE
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.VIEW_MODE;
    }
  });

  const [treeType, setTreeType] = useState<TreeType>(() => {
    try {
      return (
        (localStorage.getItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_TYPE
        ) as TreeType) || DOCUMENTATION_CONSTANTS.DEFAULTS.TREE_TYPE
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.TREE_TYPE;
    }
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.VIEW_MODE,
        mode
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleTreeTypeChange = (type: TreeType) => {
    setTreeType(type);
    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.TREE_TYPE,
        type
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  return {
    viewMode,
    treeType,
    handleViewModeChange,
    handleTreeTypeChange,
  };
};
