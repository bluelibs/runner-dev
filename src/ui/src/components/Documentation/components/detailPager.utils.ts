export interface DetailPager<T extends { id: string }> {
  previous: T;
  next: T;
  /** 1-based position of the shown element, or null when it is not listed. */
  position: number | null;
  total: number;
}

/**
 * Previous/next neighbors for the detail view, cycling through `list` (the
 * section's rows in the table's current order). An element the list does
 * not contain (filtered out, deep-linked) pages to the list's edges, even
 * when the list holds a single row. There is no pager only when there is
 * nowhere else to go: an empty list, or a lone row that is the shown
 * element (a "1 of 1" Previous/Next would only link back to itself).
 */
export function buildDetailPager<T extends { id: string }>(
  list: T[],
  selectedId: string | null
): DetailPager<T> | null {
  const onlyShowsItself = list.length === 1 && list[0].id === selectedId;
  if (list.length === 0 || onlyShowsItself) return null;
  const index = list.findIndex((item) => item.id === selectedId);
  const lastIndex = list.length - 1;
  return {
    previous: list[index <= 0 ? lastIndex : index - 1],
    next: list[index < 0 || index === lastIndex ? 0 : index + 1],
    position: index < 0 ? null : index + 1,
    total: list.length,
  };
}
