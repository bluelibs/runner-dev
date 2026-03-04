import React from "react";
import "./SearchableList.scss";

export interface SearchableListItem {
  id: string;
  title?: string | null;
  subtitle?: string | null;
}

export interface SearchableListProps {
  /** Items to display. Search appears when length > searchThreshold. */
  items: SearchableListItem[];
  /** Minimum item count before showing the search box (default: 5). */
  searchThreshold?: number;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Message shown when no items match the search query. */
  emptyMessage?: string;
  /** Optional CSS class for the item variant (e.g. "task", "resource", "registered"). */
  itemVariant?: string;
  /** Optional callback when an item is clicked (before browser navigation). */
  onItemClick?: (item: SearchableListItem) => void;
  /** Custom class name for the outer wrapper. */
  className?: string;
}

/**
 * Reusable searchable list with max-height scroll.
 * Shows a search box with count when items exceed the threshold,
 * each item rendered as a clickable card linking to `#element-<id>`.
 */
export const SearchableList: React.FC<SearchableListProps> = ({
  items,
  searchThreshold = 5,
  placeholder = "Filter...",
  emptyMessage = "No items match this search.",
  itemVariant = "task",
  onItemClick,
  className,
}) => {
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        (item.title ?? "").toLowerCase().includes(query)
    );
  }, [items, search]);

  if (items.length === 0) return null;

  return (
    <div className={`searchable-list ${className ?? ""}`}>
      {items.length > searchThreshold && (
        <div className="searchable-list__search">
          <span className="searchable-list__search-icon" aria-hidden="true">
            🔎
          </span>
          <input
            type="search"
            className="searchable-list__search-input"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="searchable-list__search-count">
            {filtered.length}/{items.length}
          </span>
        </div>
      )}
      <div className="searchable-list__items">
        {filtered.map((item) => (
          <a
            key={item.id}
            href={`#element-${item.id}`}
            className={`searchable-list__item searchable-list__item--${itemVariant}`}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          >
            {item.title && (
              <div className="searchable-list__item-title">{item.title}</div>
            )}
            <div className="searchable-list__item-id">{item.id}</div>
            {item.subtitle && (
              <div className="searchable-list__item-subtitle">
                {item.subtitle}
              </div>
            )}
          </a>
        ))}
        {filtered.length === 0 && (
          <div className="searchable-list__empty">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
};
