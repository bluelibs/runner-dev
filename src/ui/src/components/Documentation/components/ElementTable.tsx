import React from "react";
import { MarkdownRenderer } from "../utils/markdownUtils";
import {
  getLastInputModality,
  shouldAutofocusTableSearch,
} from "../utils/inputModality";
import { OverviewIdLink } from "./common/OverviewIdLink";
import { DocIcon } from "./common/DocIcon";
import { ElementTableHeader } from "./ElementTableHeader";
import {
  DEFAULT_ELEMENT_TABLE_VIEW,
  getUsedByCount,
  getVisibleTableElements,
  nextSortState,
  type BaseElement,
  type ElementTableColumnKey,
  type ElementTableView,
} from "./elementTable.utils";
import "./ElementTable.scss";

export type { BaseElement } from "./elementTable.utils";

interface ElementTableBaseProps {
  elements: BaseElement[];
  resources?: Array<Pick<BaseElement, "id" | "registeredBy">>;
  title: string;
  icon?: string;
  // Html Id to use for component
  id?: string;
  // When provided, shows a subtle action button per row and wires ExecuteModal
  // - "task" shows a Run button (InvokeTask)
  // - "event" shows an Emit button (InvokeEvent)
  // - "resource" shows a Shell button (ShellModal)
  enableActions?: "task" | "event" | "resource";
  // Callback to notify parent to handle execution in the respective Card
  onAction?: (element: BaseElement) => void;
  middlewareTypeFilters?: boolean;
}

/**
 * Sort/search state is either fully controlled (the docs page lifts it so
 * the detail pager can follow the table's order) or fully owned here.
 */
type ElementTableViewControl =
  | { view: ElementTableView; onViewChange: (view: ElementTableView) => void }
  | { view?: undefined; onViewChange?: undefined };

export type ElementTableProps = ElementTableBaseProps & ElementTableViewControl;

export const ElementTable: React.FC<ElementTableProps> = ({
  elements,
  resources = [],
  title,
  icon,
  id,
  enableActions,
  onAction,
  middlewareTypeFilters = false,
  view: controlledView,
  onViewChange,
}) => {
  const [ownView, setOwnView] = React.useState<ElementTableView>(
    DEFAULT_ELEMENT_TABLE_VIEW
  );
  const view = controlledView ?? ownView;
  const setView = onViewChange ?? setOwnView;
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const [clampedMap, setClampedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const idFilterRef = React.useRef<HTMLInputElement>(null);

  // Section opens land in the ID search so typing filters immediately —
  // unless the keyboard drove here (g-chain, palette, Escape-back): then
  // focus stays on the page so the next shortcut still fires.
  // preventScroll avoids fighting the hash-scroll pass on navigation.
  React.useEffect(() => {
    if (!shouldAutofocusTableSearch(getLastInputModality())) return;
    idFilterRef.current?.focus({ preventScroll: true });
  }, []);
  const descriptionRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const sortedElements = React.useMemo(
    () => getVisibleTableElements(elements, view, { middlewareTypeFilters }),
    [elements, view, middlewareTypeFilters]
  );

  const handleSort = (key: ElementTableColumnKey) => {
    setView({ ...view, sort: nextSortState(view.sort, key) });
  };

  const handleFilterChange = (key: ElementTableColumnKey, value: string) => {
    setView({ ...view, filters: { ...view.filters, [key]: value } });
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

  if (elements.length === 0) return null;

  const openExecuteFor = (element: BaseElement) => {
    // Defer execution to the respective Card via parent handler
    onAction?.(element);
  };

  const getElementTitle = (element: BaseElement): string | undefined => {
    return element.meta?.title;
  };

  const getMiddlewareScopeLabel = (element: BaseElement): string | null => {
    if (!middlewareTypeFilters) return null;
    if (element.type === "task") return "T";
    if (element.type === "resource") return "R";
    return null;
  };

  const openElementDetail = (elementId: string) => {
    window.location.hash = `#element-${elementId}`;
  };

  return (
    <div className="element-table" id={id}>
      <h2 className="element-table__title">
        {icon && (
          <span className="element-table__icon">
            <DocIcon name={icon} size={18} />
          </span>
        )}
        {title} ({elements.length})
      </h2>
      {middlewareTypeFilters && (
        <div
          className="element-table__scope-toggles"
          role="group"
          aria-label="Middleware overview filters"
        >
          <button
            type="button"
            className={`element-table__scope-toggle ${
              view.showTaskMiddlewares
                ? "element-table__scope-toggle--active"
                : ""
            }`}
            onClick={() =>
              setView({
                ...view,
                showTaskMiddlewares: !view.showTaskMiddlewares,
              })
            }
            aria-pressed={view.showTaskMiddlewares}
          >
            For Tasks
          </button>
          <button
            type="button"
            className={`element-table__scope-toggle ${
              view.showResourceMiddlewares
                ? "element-table__scope-toggle--active"
                : ""
            }`}
            onClick={() =>
              setView({
                ...view,
                showResourceMiddlewares: !view.showResourceMiddlewares,
              })
            }
            aria-pressed={view.showResourceMiddlewares}
          >
            For Resources
          </button>
        </div>
      )}
      <div className="element-table__container">
        <table className="element-table__table">
          <ElementTableHeader
            sort={view.sort}
            filters={view.filters}
            idSearchRef={idFilterRef}
            onSort={handleSort}
            onFilterChange={handleFilterChange}
          />
          <tbody>
            {sortedElements.map((element) => {
              const isExpanded = !!expandedMap[element.id];
              const usedByCount = getUsedByCount(element);

              return (
                <tr
                  key={element.id}
                  className="element-table__row element-table__row--clickable"
                  onClick={() => openElementDetail(element.id)}
                >
                  <td className="element-table__cell element-table__cell--id">
                    <div className="element-table__id-container">
                      <OverviewIdLink
                        element={element}
                        resources={resources}
                        href={`#element-${element.id}`}
                        classNames={{
                          shell: "element-table__id-shell",
                          code: "element-table__id-code",
                          codeExpanded: "element-table__id-code--expanded",
                          label: "element-table__id-label",
                          link: "element-table__id-link",
                          expand: "element-table__id-expand",
                          separator: "element-table__id-separator",
                        }}
                      />
                    </div>
                  </td>

                  <td className="element-table__cell element-table__cell--title">
                    <a
                      href={`#element-${element.id}`}
                      className="element-table__title-link"
                      title={getElementTitle(element) || element.id}
                    >
                      <span className="element-table__title-content">
                        <span className="element-table__title-text">
                          {getElementTitle(element) || (
                            <span className="element-table__empty">
                              Untitled
                            </span>
                          )}
                        </span>
                        {getMiddlewareScopeLabel(element) && (
                          <span className="element-table__scope-badge">
                            {getMiddlewareScopeLabel(element)}
                          </span>
                        )}
                        {element.isPrivate && (
                          <span className="element-table__private-marker">
                            private
                          </span>
                        )}
                      </span>
                    </a>
                    {enableActions && (
                      <button
                        className={`element-table__action-btn ${
                          enableActions === "task"
                            ? "element-table__action-btn--run"
                            : enableActions === "event"
                            ? "element-table__action-btn--emit"
                            : "element-table__action-btn--shell"
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openExecuteFor(element);
                        }}
                        title={
                          enableActions === "task"
                            ? "Run Task"
                            : enableActions === "event"
                            ? "Emit Event"
                            : "Open Shell"
                        }
                        aria-label={
                          enableActions === "task"
                            ? "Run"
                            : enableActions === "event"
                            ? "Emit"
                            : "Shell"
                        }
                      >
                        {enableActions === "task"
                          ? "Run"
                          : enableActions === "event"
                          ? "Emit"
                          : "Shell"}
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
