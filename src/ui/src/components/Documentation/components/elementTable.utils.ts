import { matchesFuzzyText } from "../utils/commandPalette";

export type ElementTableColumnKey = "id" | "title" | "description" | "usedBy";
export type ElementTableSortDirection = "asc" | "desc";

export interface ElementTableSort {
  key: ElementTableColumnKey;
  direction: ElementTableSortDirection;
}

export type ElementTableColumnFilters = Record<ElementTableColumnKey, string>;

/** Everything that decides which rows a table shows, and in which order. */
export interface ElementTableView {
  sort: ElementTableSort | null;
  filters: ElementTableColumnFilters;
  showTaskMiddlewares: boolean;
  showResourceMiddlewares: boolean;
}

export const DEFAULT_ELEMENT_TABLE_VIEW: ElementTableView = {
  sort: null,
  filters: { id: "", title: "", description: "", usedBy: "" },
  showTaskMiddlewares: true,
  showResourceMiddlewares: true,
};

/** Header order; also the order arrow keys walk the sort buttons in. */
export const ELEMENT_TABLE_COLUMN_KEYS: readonly ElementTableColumnKey[] = [
  "id",
  "title",
  "description",
  "usedBy",
];

export interface BaseElement {
  id: string;
  type?: string;
  registeredBy?: string | null;
  isPrivate?: boolean;
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
  taskMiddlewares?: unknown[];
  resourceMiddlewares?: unknown[];
  events?: unknown[];
  errors?: unknown[];
}

function countUnique(...groups: Array<string[] | undefined>): number {
  const allIds = new Set<string>();
  groups.forEach((group) => group?.forEach((id) => allIds.add(id)));
  return allIds.size;
}

export function getUsedByCount(element: BaseElement): number {
  if (Array.isArray(element.usedBy)) return element.usedBy.length;
  if (
    Array.isArray(element.usedByTasks) ||
    Array.isArray(element.usedByResources)
  ) {
    return countUnique(element.usedByTasks, element.usedByResources);
  }
  if (Array.isArray(element.emittedBy) || Array.isArray(element.listenedToBy)) {
    return countUnique(element.emittedBy, element.listenedToBy);
  }
  if (Array.isArray(element.thrownBy)) return element.thrownBy.length;

  // Tag model: count all referenced elements.
  const taggedGroups = [
    element.tasks,
    element.hooks,
    element.resources,
    element.middlewares,
    element.taskMiddlewares,
    element.resourceMiddlewares,
    element.events,
    element.errors,
  ];
  return taggedGroups.reduce((total, group) => total + (group?.length ?? 0), 0);
}

function isInMiddlewareScope(
  element: BaseElement,
  view: ElementTableView
): boolean {
  if (element.type === "task") return view.showTaskMiddlewares;
  if (element.type === "resource") return view.showResourceMiddlewares;
  return true;
}

function matchesColumnFilters(
  element: BaseElement,
  filters: ElementTableColumnFilters
): boolean {
  const descriptionFilter = filters.description.trim().toLowerCase();
  const usedByFilter = filters.usedBy.trim().toLowerCase();
  const description = (element.meta?.description ?? "").toLowerCase();

  // ID and Title are fuzzy; Description and Used By stay exact-substring
  // (long prose and numeric counts).
  return (
    matchesFuzzyText(filters.id, element.id) &&
    matchesFuzzyText(filters.title, element.meta?.title ?? "") &&
    (!descriptionFilter || description.includes(descriptionFilter)) &&
    (!usedByFilter || String(getUsedByCount(element)).includes(usedByFilter))
  );
}

function getSortValue(
  element: BaseElement,
  key: ElementTableColumnKey
): string | number {
  if (key === "id") return element.id;
  if (key === "title") return element.meta?.title ?? "";
  if (key === "description") return element.meta?.description ?? "";
  return getUsedByCount(element);
}

function compareSortValues(
  left: string | number,
  right: string | number
): number {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortTableElements<T extends BaseElement>(
  elements: T[],
  sort: ElementTableSort | null
): T[] {
  if (!sort) return elements;
  const sign = sort.direction === "asc" ? 1 : -1;
  // Ties keep source order in both directions.
  return elements
    .map((element, index) => ({ element, index }))
    .sort(
      (left, right) =>
        sign *
          compareSortValues(
            getSortValue(left.element, sort.key),
            getSortValue(right.element, sort.key)
          ) || left.index - right.index
    )
    .map(({ element }) => element);
}

/**
 * The rows a table shows for `view`, in display order. Shared with the
 * detail pager so paging walks exactly what the reader saw in the list.
 */
export function getVisibleTableElements<T extends BaseElement>(
  elements: T[],
  view: ElementTableView,
  options: { middlewareTypeFilters: boolean }
): T[] {
  const visible = elements.filter(
    (element) =>
      (!options.middlewareTypeFilters || isInMiddlewareScope(element, view)) &&
      matchesColumnFilters(element, view.filters)
  );
  return sortTableElements(visible, view.sort);
}

/** Header clicks cycle: unsorted → ascending → descending → unsorted. */
export function nextSortState(
  previous: ElementTableSort | null,
  key: ElementTableColumnKey
): ElementTableSort | null {
  if (!previous || previous.key !== key) return { key, direction: "asc" };
  return previous.direction === "asc" ? { key, direction: "desc" } : null;
}

export function getColumnSortState(
  sort: ElementTableSort | null,
  key: ElementTableColumnKey
): "none" | "ascending" | "descending" {
  if (!sort || sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

/** Sort button reached by an arrow/Home/End key (wrapping); null otherwise. */
export function getAdjacentSortKey(
  current: ElementTableColumnKey,
  keyboardKey: string
): ElementTableColumnKey | null {
  const keys = ELEMENT_TABLE_COLUMN_KEYS;
  const index = keys.indexOf(current);
  switch (keyboardKey) {
    case "ArrowRight":
      return keys[(index + 1) % keys.length];
    case "ArrowLeft":
      return keys[(index - 1 + keys.length) % keys.length];
    case "Home":
      return keys[0];
    case "End":
      return keys[keys.length - 1];
    default:
      return null;
  }
}
