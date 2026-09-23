/** @jest-environment node */

import { buildDetailPager } from "./detailPager.utils";

const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("buildDetailPager", () => {
  it("has no pager when there is nowhere else to go", () => {
    expect(buildDetailPager(rows(), "a")).toBeNull();
    expect(buildDetailPager(rows("a"), "a")).toBeNull();
    expect(buildDetailPager(rows("b"), "a")).toBeNull();
  });

  it("links both neighbors with a position counter", () => {
    expect(buildDetailPager(rows("a", "b", "c"), "b")).toEqual({
      previous: { id: "a" },
      next: { id: "c" },
      position: 2,
      total: 3,
    });
  });

  it("cycles at both ends", () => {
    const pagerAtStart = buildDetailPager(rows("a", "b", "c"), "a");
    expect(pagerAtStart?.previous.id).toBe("c");
    const pagerAtEnd = buildDetailPager(rows("a", "b", "c"), "c");
    expect(pagerAtEnd?.next.id).toBe("a");
  });

  it("pages an unlisted element to the list edges without a position", () => {
    expect(buildDetailPager(rows("a", "b"), "hidden")).toEqual({
      previous: { id: "b" },
      next: { id: "a" },
      position: null,
      total: 2,
    });
    expect(buildDetailPager(rows("a", "b"), null)?.position).toBeNull();
  });
});
