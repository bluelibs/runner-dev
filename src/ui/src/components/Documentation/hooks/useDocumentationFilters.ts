import { useState, useEffect, useMemo } from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";
import { parseSearchQuery, elementMatchesParsed } from "../utils/search-utils";
import { isSystemElement } from "../utils/isSystemElement";
import { isRunnerElement } from "../utils/isRunnerElement";

export const useDocumentationFilters = (
  introspector: Introspector,
  namespacePrefix?: string
) => {
  const withType = <T extends { id: string }>(type: string, items: T[]) =>
    items.map((item) => ({ ...item, type }));

  const readStoredBoolean = (key: string, fallback: boolean): boolean => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === "1";
    } catch {
      return fallback;
    }
  };

  const [localNamespaceSearch, setLocalNamespaceSearch] = useState(
    namespacePrefix || ""
  );

  const parsedSearch = useMemo(
    () => parseSearchQuery(localNamespaceSearch),
    [localNamespaceSearch]
  );

  const [showSystem, setShowSystem] = useState<boolean>(() =>
    readStoredBoolean(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_SYSTEM,
      DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_SYSTEM
    )
  );
  const [showRunner, setShowRunner] = useState<boolean>(() =>
    readStoredBoolean(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_RUNNER,
      DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_RUNNER
    )
  );
  const [showPrivate, setShowPrivate] = useState<boolean>(() =>
    readStoredBoolean(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE,
      DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_PRIVATE
    )
  );

  useEffect(() => {
    setLocalNamespaceSearch(namespacePrefix || "");
  }, [namespacePrefix]);

  const applyFilters = <
    T extends { id: string; tags?: string[] | null; isPrivate?: boolean }
  >(
    items: T[],
    kind?:
      | "task"
      | "resource"
      | "event"
      | "hook"
      | "middleware"
      | "error"
      | "async-context"
  ): T[] => {
    let result = items;
    if (!showSystem) {
      result = result.filter((item) => !isSystemElement(item));
    }
    if (!showRunner) {
      result = result.filter((item) => !isRunnerElement(item));
    }
    if (!showPrivate) {
      result = result.filter((item) => item.isPrivate !== true);
    }
    if (localNamespaceSearch) {
      // Elements: if tag-search, match by tag ids; otherwise match by id
      result = result.filter((item) =>
        elementMatchesParsed(
          { id: item.id, tags: item.tags || [], kind },
          parsedSearch
        )
      );
    }
    return result;
  };

  const filteredData = useMemo(() => {
    const tasks = applyFilters(introspector.getTasks(), "task");
    const resources = applyFilters(introspector.getResources(), "resource");
    const events = applyFilters(introspector.getEvents(), "event");
    const hooks = applyFilters(introspector.getHooks(), "hook");
    const middlewares = applyFilters(
      introspector.getMiddlewares(),
      "middleware"
    );
    const errors = applyFilters(introspector.getErrors(), "error");
    const asyncContexts = applyFilters(
      introspector.getAsyncContexts(),
      "async-context"
    );

    // Tags list: keep consistent behavior — always filter by id text
    let tags = introspector.getAllTags();
    if (!showSystem) {
      tags = tags.filter((t) => !isSystemElement(t));
    }
    if (!showRunner) {
      tags = tags.filter((t) => !isRunnerElement(t));
    }
    if (!showPrivate) {
      tags = tags.filter((t) => t.isPrivate !== true);
    }
    if (localNamespaceSearch) {
      const body = parsedSearch.isTagSearch
        ? localNamespaceSearch.trim().slice(1)
        : localNamespaceSearch.trim();
      const tagParsed = parseSearchQuery(body); // treat as normal text search on tag ids
      tags = tags.filter((t) =>
        elementMatchesParsed({ id: t.id, tags: [] }, tagParsed)
      );
    }

    return {
      tasks,
      resources,
      events,
      hooks,
      middlewares,
      tags,
      allElements: [
        ...withType("task", tasks),
        ...withType("resource", resources),
        ...withType("event", events),
        ...withType("hook", hooks),
        ...withType("middleware", middlewares),
        ...withType("error", errors),
        ...withType("async-context", asyncContexts),
        ...withType("tag", tags),
      ],
      errors,
      asyncContexts,
    };
  }, [
    introspector,
    showSystem,
    showRunner,
    showPrivate,
    localNamespaceSearch,
    parsedSearch,
  ]);

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

  const handleShowPrivateChange = (value: boolean) => {
    setShowPrivate(value);
    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE,
        value ? "1" : "0"
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleShowRunnerChange = (value: boolean) => {
    setShowRunner(value);
    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_RUNNER,
        value ? "1" : "0"
      );
    } catch {
      // Ignore localStorage errors
    }
  };

  const resetFilters = () => {
    setLocalNamespaceSearch("");
    handleShowSystemChange(DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_SYSTEM);
    handleShowRunnerChange(DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_RUNNER);
    handleShowPrivateChange(DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_PRIVATE);
  };

  return {
    localNamespaceSearch,
    setLocalNamespaceSearch,
    showSystem,
    showRunner,
    showPrivate,
    handleShowSystemChange,
    handleShowRunnerChange,
    handleShowPrivateChange,
    resetFilters,
    isSystemElement,
    isRunnerElement,
    applyFilters,
    ...filteredData,
  };
};
