import { useState, useEffect, useMemo } from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";

export const useDocumentationFilters = (
  introspector: Introspector,
  namespacePrefix?: string
) => {
  const [localNamespaceSearch, setLocalNamespaceSearch] = useState(
    namespacePrefix || ""
  );

  const localNamespaceSearchLower = localNamespaceSearch.toLowerCase();

  const [showSystem, setShowSystem] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_SYSTEM
        ) === "1"
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_SYSTEM;
    }
  });

  useEffect(() => {
    setLocalNamespaceSearch(namespacePrefix || "");
  }, [namespacePrefix]);

  const isSystemElement = (el: any): boolean => {
    if (!el) return false;
    if (Array.isArray((el as any)?.tags)) {
      return (el as any).tags.includes(DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID);
    }
    return (el as any)?.id === DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID;
  };

  const applyFilters = <T extends { id: string }>(items: T[]): T[] => {
    let result = items;
    if (!showSystem) {
      result = result.filter((item) => !isSystemElement(item));
    }
    if (localNamespaceSearch) {
      result = result.filter((item) =>
        item.id.toLowerCase().includes(localNamespaceSearchLower)
      );
    }
    return result;
  };

  const filteredData = useMemo(() => {
    const tasks = applyFilters(introspector.getTasks());
    const resources = applyFilters(introspector.getResources());
    const events = applyFilters(introspector.getEvents());
    const hooks = applyFilters(introspector.getHooks());
    const middlewares = applyFilters(introspector.getMiddlewares());
    const tags = applyFilters(introspector.getAllTags());

    return {
      tasks,
      resources,
      events,
      hooks,
      middlewares,
      tags,
      allElements: [
        ...tasks,
        ...resources,
        ...events,
        ...hooks,
        ...middlewares,
        ...tags,
      ],
    };
  }, [introspector, showSystem, localNamespaceSearchLower]);

  const handleShowSystemChange = (value: boolean) => {
    setShowSystem(value);
    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_SYSTEM,
        value ? "1" : "0"
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  const resetFilters = () => {
    setLocalNamespaceSearch("");
    handleShowSystemChange(true);
  };

  return {
    localNamespaceSearch,
    setLocalNamespaceSearch,
    showSystem,
    handleShowSystemChange,
    resetFilters,
    isSystemElement,
    applyFilters,
    ...filteredData,
  };
};
