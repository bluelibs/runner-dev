import React from "react";
import {
  getAdjacentSortKey,
  getColumnSortState,
  type ElementTableColumnFilters,
  type ElementTableColumnKey,
  type ElementTableSort,
} from "./elementTable.utils";

interface ColumnSpec {
  key: ElementTableColumnKey;
  label: string;
  modifier: string;
  placeholder: string;
  searchLabel: string;
}

const COLUMNS: readonly ColumnSpec[] = [
  {
    key: "id",
    label: "ID",
    modifier: "id",
    placeholder: "Search ID",
    searchLabel: "Search by ID",
  },
  {
    key: "title",
    label: "Title",
    modifier: "title",
    placeholder: "Search Title",
    searchLabel: "Search by Title",
  },
  {
    key: "description",
    label: "Description",
    modifier: "description",
    placeholder: "Search Description",
    searchLabel: "Search by Description",
  },
  {
    key: "usedBy",
    label: "Used By",
    modifier: "used-by",
    placeholder: "Search Count",
    searchLabel: "Search by Used By count",
  },
];

const SORT_INDICATORS = {
  none: { modifier: "neutral", glyph: "↑↓" },
  ascending: { modifier: "ascending", glyph: "↑" },
  descending: { modifier: "descending", glyph: "↓" },
} as const;

/**
 * The four sort buttons share a single Tab stop (the ID column's, right
 * before the ID search) and arrow keys walk between them. That keeps the
 * search inputs back-to-back in Tab order while every sort stays reachable
 * from the keyboard.
 */
const SORT_TAB_STOP: ElementTableColumnKey = "id";

export interface ElementTableHeaderProps {
  sort: ElementTableSort | null;
  filters: ElementTableColumnFilters;
  idSearchRef: React.RefObject<HTMLInputElement>;
  onSort: (key: ElementTableColumnKey) => void;
  onFilterChange: (key: ElementTableColumnKey, value: string) => void;
}

export const ElementTableHeader: React.FC<ElementTableHeaderProps> = ({
  sort,
  filters,
  idSearchRef,
  onSort,
  onFilterChange,
}) => {
  const sortButtonRefs = React.useRef<
    Partial<Record<ElementTableColumnKey, HTMLButtonElement | null>>
  >({});

  const handleSortKeyDown =
    (current: ElementTableColumnKey) =>
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const target = getAdjacentSortKey(current, event.key);
      if (!target) return;
      event.preventDefault();
      sortButtonRefs.current[target]?.focus();
    };

  return (
    <thead>
      <tr>
        {COLUMNS.map((column) => {
          const sortState = getColumnSortState(sort, column.key);
          const indicator = SORT_INDICATORS[sortState];
          return (
            <th
              key={column.key}
              className={`element-table__header element-table__header--${column.modifier}`}
              aria-sort={sortState}
            >
              <div className="element-table__header-content">
                <button
                  ref={(button) => {
                    sortButtonRefs.current[column.key] = button;
                  }}
                  className="element-table__sort-btn"
                  type="button"
                  tabIndex={column.key === SORT_TAB_STOP ? 0 : -1}
                  title={`Sort by ${column.label} (arrow keys switch columns)`}
                  onClick={() => onSort(column.key)}
                  onKeyDown={handleSortKeyDown(column.key)}
                >
                  <span>{column.label}</span>
                  <span
                    className={`element-table__sort-indicator element-table__sort-indicator--${indicator.modifier}`}
                    aria-hidden
                  >
                    {indicator.glyph}
                  </span>
                </button>
                <input
                  type="search"
                  ref={column.key === "id" ? idSearchRef : undefined}
                  className="element-table__filter-input"
                  value={filters[column.key]}
                  onChange={(event) =>
                    onFilterChange(column.key, event.target.value)
                  }
                  placeholder={column.placeholder}
                  aria-label={column.searchLabel}
                />
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};
