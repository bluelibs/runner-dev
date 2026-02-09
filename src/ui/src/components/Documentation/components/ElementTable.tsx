import React from "react";
import { MarkdownRenderer } from "../utils/markdownUtils";
import "./ElementTable.scss";

type SortKey = "id" | "title" | "description" | "usedBy";
type SortDirection = "asc" | "desc";
type ColumnFilters = Record<SortKey, string>;

export interface BaseElement {
  id: string;
  meta?: {
    title?: string;
    description?: string;
  };
  usedBy?: string[];
  usedByTasks?: string[];
  usedByResources?: string[];
  listenedToBy?: string[];
  emittedBy?: string[];
  thrownBy?: string[];
  tasks?: unknown[];
  hooks?: unknown[];
  resources?: unknown[];
  middlewares?: unknown[];
  events?: unknown[];
}

export interface ElementTableProps {
  elements: BaseElement[];
  title: string;
  icon?: string;
  // Html Id to use for component
  id?: string;
  // When provided, shows a subtle action button per row and wires ExecuteModal
  // - "task" shows a Run button (InvokeTask)
  // - "event" shows an Emit button (InvokeEvent)
  enableActions?: "task" | "event";
  // Callback to notify parent to handle execution in the respective Card
  onAction?: (element: BaseElement) => void;
}

export const ElementTable: React.FC<ElementTableProps> = ({
  elements,
  title,
  icon,
  id,
  enableActions,
  onAction,
}) => {
  const [sortState, setSortState] = React.useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFilters>({
    id: "",
    title: "",
    description: "",
    usedBy: "",
  });
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const [clampedMap, setClampedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const descriptionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const getUsedByCount = React.useCallback((element: BaseElement): number => {
    const getUniqueCount = (...groups: Array<string[] | undefined>): number => {
      const allIds = new Set<string>();
      groups.forEach((group) => {
        group?.forEach((id) => allIds.add(id));
      });
      return allIds.size;
    };

    if (Array.isArray(element.usedBy)) return element.usedBy.length;
    if (
      Array.isArray(element.usedByTasks) ||
      Array.isArray(element.usedByResources)
    ) {
      return getUniqueCount(element.usedByTasks, element.usedByResources);
    }
    if (
      Array.isArray(element.emittedBy) ||
      Array.isArray(element.listenedToBy)
    ) {
      return getUniqueCount(element.emittedBy, element.listenedToBy);
    }
    if (Array.isArray(element.thrownBy)) return element.thrownBy.length;

    // Tag model: count all referenced elements.
    if (
      Array.isArray(element.tasks) ||
      Array.isArray(element.hooks) ||
      Array.isArray(element.resources) ||
      Array.isArray(element.middlewares) ||
      Array.isArray(element.events)
    ) {
      return (
        (element.tasks?.length ?? 0) +
        (element.hooks?.length ?? 0) +
        (element.resources?.length ?? 0) +
        (element.middlewares?.length ?? 0) +
        (element.events?.length ?? 0)
      );
    }

    return 0;
  }, []);

  const filteredElements = React.useMemo(() => {
    const idFilter = columnFilters.id.trim().toLowerCase();
    const titleFilter = columnFilters.title.trim().toLowerCase();
    const descriptionFilter = columnFilters.description.trim().toLowerCase();
    const usedByFilter = columnFilters.usedBy.trim().toLowerCase();

    if (!idFilter && !titleFilter && !descriptionFilter && !usedByFilter) {
      return elements;
    }

    return elements.filter((element) => {
      const idValue = element.id.toLowerCase();
      const titleValue = (element.meta?.title ?? "").toLowerCase();
      const descriptionValue = (element.meta?.description ?? "").toLowerCase();
      const usedByValue = String(getUsedByCount(element)).toLowerCase();

      return (
        (!idFilter || idValue.includes(idFilter)) &&
        (!titleFilter || titleValue.includes(titleFilter)) &&
        (!descriptionFilter || descriptionValue.includes(descriptionFilter)) &&
        (!usedByFilter || usedByValue.includes(usedByFilter))
      );
    });
  }, [columnFilters, elements, getUsedByCount]);

  const sortedElements = React.useMemo(() => {
    if (!sortState) return filteredElements;

    const compareStrings = (left: string, right: string): number =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      });

    const getSortValue = (
      element: BaseElement,
      key: SortKey
    ): string | number => {
      if (key === "id") return element.id;
      if (key === "title") return element.meta?.title ?? "";
      if (key === "description") return element.meta?.description ?? "";
      return getUsedByCount(element);
    };

    return [...filteredElements]
      .map((element, index) => ({ element, index }))
      .sort((left, right) => {
        const leftValue = getSortValue(left.element, sortState.key);
        const rightValue = getSortValue(right.element, sortState.key);

        const comparison =
          typeof leftValue === "number" && typeof rightValue === "number"
            ? leftValue - rightValue
            : compareStrings(String(leftValue), String(rightValue));

        if (comparison === 0) return left.index - right.index;
        return sortState.direction === "asc" ? comparison : -comparison;
      })
      .map(({ element }) => element);
  }, [filteredElements, getUsedByCount, sortState]);

  const getSortIndicator = (key: SortKey): string => {
    if (!sortState || sortState.key !== key) return "↑↓";
    return sortState.direction === "asc" ? "↑" : "↓";
  };

  const getAriaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (!sortState || sortState.key !== key) return "none";
    return sortState.direction === "asc" ? "ascending" : "descending";
  };

  const handleSort = (key: SortKey) => {
    setSortState((previousState) => {
      if (!previousState || previousState.key !== key) {
        return { key, direction: "asc" };
      }

      return {
        key,
        direction: previousState.direction === "asc" ? "desc" : "asc",
      };
    });
  };

  const handleFilterChange = (key: SortKey, value: string) => {
    setColumnFilters((previousFilters) => ({
      ...previousFilters,
      [key]: value,
    }));
  };

  const toggleExpanded = (elementId: string) => {
    setExpandedMap((prev) => ({ ...prev, [elementId]: !prev[elementId] }));
  };

  React.useEffect(() => {
    const checkAllClamped = () => {
      const newClampedMap: Record<string, boolean> = {};

      Object.entries(descriptionRefs.current).forEach(
        ([elementId, element]) => {
          if (element) {
            const firstChild = element.firstElementChild;
            if (firstChild) {
              const isClamped =
                firstChild.scrollHeight > firstChild.clientHeight;
              newClampedMap[elementId] = isClamped;
            }
          }
        }
      );

      setClampedMap(newClampedMap);
    };

    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(checkAllClamped, 0);
    return () => clearTimeout(timer);
  }, [sortedElements]);

  const _copyToClipboard = async (text: string) => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        navigator.clipboard.writeText
      ) {
        await navigator.clipboard.writeText(text);
      }
    } catch (_e) {
      // ignore
    }
  };

  if (elements.length === 0) return null;

  const openExecuteFor = (element: BaseElement) => {
    // Defer execution to the respective Card via parent handler
    onAction?.(element);
  };

  return (
    <div className="element-table" id={id}>
      <h2 className="element-table__title">
        {icon && <span className="element-table__icon">{icon}</span>}
        {title} ({elements.length})
      </h2>
      <div className="element-table__container">
        <table className="element-table__table">
          <thead>
            <tr>
              <th
                className="element-table__header element-table__header--id"
                aria-sort={getAriaSort("id")}
              >
                <div className="element-table__header-content">
                  <button
                    className="element-table__sort-btn"
                    type="button"
                    onClick={() => handleSort("id")}
                  >
                    <span>ID</span>
                    <span className="element-table__sort-indicator" aria-hidden>
                      {getSortIndicator("id")}
                    </span>
                  </button>
                  <input
                    type="search"
                    className="element-table__filter-input"
                    value={columnFilters.id}
                    onChange={(event) =>
                      handleFilterChange("id", event.target.value)
                    }
                    placeholder="Search ID"
                    aria-label="Search by ID"
                  />
                </div>
              </th>
              <th
                className="element-table__header element-table__header--title"
                aria-sort={getAriaSort("title")}
              >
                <div className="element-table__header-content">
                  <button
                    className="element-table__sort-btn"
                    type="button"
                    onClick={() => handleSort("title")}
                  >
                    <span>Title</span>
                    <span className="element-table__sort-indicator" aria-hidden>
                      {getSortIndicator("title")}
                    </span>
                  </button>
                  <input
                    type="search"
                    className="element-table__filter-input"
                    value={columnFilters.title}
                    onChange={(event) =>
                      handleFilterChange("title", event.target.value)
                    }
                    placeholder="Search Title"
                    aria-label="Search by Title"
                  />
                </div>
              </th>
              <th
                className="element-table__header element-table__header--description"
                aria-sort={getAriaSort("description")}
              >
                <div className="element-table__header-content">
                  <button
                    className="element-table__sort-btn"
                    type="button"
                    onClick={() => handleSort("description")}
                  >
                    <span>Description</span>
                    <span className="element-table__sort-indicator" aria-hidden>
                      {getSortIndicator("description")}
                    </span>
                  </button>
                  <input
                    type="search"
                    className="element-table__filter-input"
                    value={columnFilters.description}
                    onChange={(event) =>
                      handleFilterChange("description", event.target.value)
                    }
                    placeholder="Search Description"
                    aria-label="Search by Description"
                  />
                </div>
              </th>
              <th
                className="element-table__header element-table__header--used-by"
                aria-sort={getAriaSort("usedBy")}
              >
                <div className="element-table__header-content">
                  <button
                    className="element-table__sort-btn"
                    type="button"
                    onClick={() => handleSort("usedBy")}
                  >
                    <span>Used By</span>
                    <span className="element-table__sort-indicator" aria-hidden>
                      {getSortIndicator("usedBy")}
                    </span>
                  </button>
                  <input
                    type="search"
                    className="element-table__filter-input"
                    value={columnFilters.usedBy}
                    onChange={(event) =>
                      handleFilterChange("usedBy", event.target.value)
                    }
                    placeholder="Search Count"
                    aria-label="Search by Used By count"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedElements.map((element) => {
              const isExpanded = !!expandedMap[element.id];
              const usedByCount = getUsedByCount(element);

              return (
                <tr key={element.id} className="element-table__row">
                  <td className="element-table__cell element-table__cell--id">
                    <div className="element-table__id-container">
                      <a
                        href={`#element-${element.id}`}
                        className="element-table__id-link"
                        title={element.id}
                      >
                        <code className="element-table__id-code">
                          {element.id}
                        </code>
                      </a>
                    </div>
                  </td>

                  <td className="element-table__cell element-table__cell--title">
                    <a
                      href={`#element-${element.id}`}
                      className="element-table__title-link"
                      title={element.meta?.title || element.id}
                    >
                      {element.meta?.title || (
                        <span className="element-table__empty">Untitled</span>
                      )}
                    </a>
                    {enableActions && (
                      <button
                        className={`element-table__action-btn ${
                          enableActions === "task"
                            ? "element-table__action-btn--run"
                            : "element-table__action-btn--emit"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openExecuteFor(element);
                        }}
                        title={
                          enableActions === "task" ? "Run Task" : "Emit Event"
                        }
                        aria-label={enableActions === "task" ? "Run" : "Emit"}
                      >
                        {enableActions === "task" ? "Run" : "Emit"}
                      </button>
                    )}
                  </td>

                  <td className="element-table__cell element-table__cell--description">
                    {element.meta?.description ? (
                      <div className="element-table__description-container">
                        <div
                          ref={(el) => {
                            descriptionRefs.current[element.id] = el;
                          }}
                          className={`element-table__description ${
                            isExpanded ? "expanded" : ""
                          }`}
                        >
                          <MarkdownRenderer
                            content={element.meta.description}
                          />
                        </div>
                        {clampedMap[element.id] && (
                          <button
                            className="element-table__expand-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(element.id);
                            }}
                            aria-expanded={isExpanded}
                            title={isExpanded ? "Show less" : "Show more"}
                          >
                            {isExpanded ? "Less" : "More"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="element-table__empty">-</span>
                    )}
                  </td>

                  <td className="element-table__cell element-table__cell--used-by">
                    {usedByCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
