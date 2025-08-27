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
}

export const ElementTable: React.FC<ElementTableProps> = ({
  elements,
  title,
  icon,
  id,
}) => {
  const splitId = (fullId: string) => {
    const patterns = [
      ".tasks.",
      ".tags.",
      ".events.",
      ".hooks.",
      ".resources.",
      ".middleware.task.",
      ".middleware.resource.",
    ];
    for (const pattern of patterns) {
      const idx = fullId.indexOf(pattern);
      if (idx !== -1) {
        const domain = fullId.slice(0, idx);
        const leaf = fullId.slice(idx + pattern.length);
        return { domain, leaf };
      }
    }
    const lastDot = fullId.lastIndexOf(".");
    if (lastDot !== -1) {
      return {
        domain: fullId.slice(0, lastDot),
        leaf: fullId.slice(lastDot + 1),
      };
    }
    return { domain: "", leaf: fullId };
  };

  if (elements.length === 0) return null;

  return (
    <div className="element-table" id={id}>
      <h3 className="element-table__title">
        {icon && <span className="element-table__icon">{icon}</span>}
        {title} ({elements.length})
      </h3>
      <div className="element-table__container">
        <table className="element-table__table">
          <thead>
            <tr>
              <th className="element-table__header element-table__header">
                Domain
              </th>
              <th className="element-table__header element-table__header--id">
                ID & Title
              </th>
              {/* <th className="element-table__header element-table__header--title">
                Title
              </th> */}
              <th className="element-table__header element-table__header--description">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {elements.map((element) => {
              const { domain, leaf } = splitId(element.id);
              return (
                <tr key={element.id} className="element-table__row">
                  <td
                    className="element-table__cell element-table__cell"
                    title={domain || element.id}
                  >
                    {domain || "—"}
                  </td>
                  <td className="element-table__cell element-table__cell">
                    <a
                      href={`#element-${element.id}`}
                      className="element-table__link"
                      title={element.id}
                    >
                      <code className="element-table__code">{leaf}</code>
                    </a>
                  </td>
                  <td className="element-table__cell element-table__cell--description">
                    <div className="element-table__full-id">
                      <a
                        href={`#element-${element.id}`}
                        className="element-table__full-id-link"
                        title={element.id}
                      >
                        <code className="element-table__code element-table__code--inline">
                          {element.id}
                        </code>
                      </a>
                    </div>
                    <div className="element-table__title">
                      {element.meta?.title}
                    </div>
                    {element.meta?.description ? (
                      <MarkdownRenderer
                        content={element.meta.description}
                        className="element-table__description"
                      />
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
