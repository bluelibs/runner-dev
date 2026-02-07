import React from "react";
import { MarkdownRenderer } from "../utils/markdownUtils";
import "./ElementTable.scss";

export interface BaseElement {
  id: string;
  meta?: {
    title?: string;
    description?: string;
  };
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
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const [clampedMap, setClampedMap] = React.useState<Record<string, boolean>>(
    {}
  );
  const descriptionRefs = React.useRef<Record<string, HTMLElement | null>>({});

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
  }, [elements]);

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
              <th className="element-table__header element-table__header--id">
                ID
              </th>
              <th className="element-table__header element-table__header--title">
                Title
              </th>
              <th className="element-table__header element-table__header--description">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {elements.map((element) => {
              const isExpanded = !!expandedMap[element.id];

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
                      <span className="element-table__empty">—</span>
                    )}
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
