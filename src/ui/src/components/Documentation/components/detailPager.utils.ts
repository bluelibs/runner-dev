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
 * not contain (filtered out, deep-linked) pages to the list's edges. With
 * one row or none there is nowhere to page to, so there is no pager: a
 * lone "1 of 1" Previous/Next would only link back to itself.
 */
export function buildDetailPager<T extends { id: string }>(
  list: T[],
  selectedId: string | null
): DetailPager<T> | null {
  if (list.length <= 1) return null;
  const index = list.findIndex((item) => item.id === selectedId);
  const lastIndex = list.length - 1;
  return {
    previous: list[index <= 0 ? lastIndex : index - 1],
    next: list[index < 0 || index === lastIndex ? 0 : index + 1],
    position: index < 0 ? null : index + 1,
    total: list.length,
  };
}
