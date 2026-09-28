/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import {
  MiddlewareUsagesSection,
  describeSubtreeProvenance,
  type MiddlewareUsageView,
} from "./MiddlewareUsagesSection";

function usage(
  id: string,
  overrides: Partial<MiddlewareUsageView> = {}
): MiddlewareUsageView {
  return {
    id,
    config: null,
    origin: "local",
    subtreeOwnerId: null,
    node: { meta: null },
    ...overrides,
  };
}

describe("describeSubtreeProvenance", () => {
  it("has nothing to explain for locally declared middleware", () => {
    expect(describeSubtreeProvenance(usage("app.mw.local"))).toBeNull();
  });

  it("names the owning resource of subtree-applied middleware", () => {
    expect(
      describeSubtreeProvenance(
        usage("app.mw.audit", {
          origin: "subtree",
          subtreeOwnerId: "app.features",
        })
      )
    ).toEqual({
      badgeTitle: "Applied by subtree policy from app.features",
      ownerId: "app.features",
    });
  });

  it("still flags subtree middleware whose owner is unknown", () => {
    expect(
      describeSubtreeProvenance(usage("app.mw.audit", { origin: "subtree" }))
    ).toEqual({ badgeTitle: "Applied by subtree policy", ownerId: null });
  });
});

describe("MiddlewareUsagesSection", () => {
  it("renders nothing without usages", () => {
    const { container } = render(<MiddlewareUsagesSection usages={[]} />);

    expect(container.innerHTML).toBe("");
  });

  it("badges and links the owner only for subtree-applied middleware", () => {
    const { container } = render(
      <MiddlewareUsagesSection
        usages={[
          usage("app.mw.audit", {
            origin: "subtree",
            subtreeOwnerId: "app.features.catalog",
            node: { meta: { title: "Audit" } },
          }),
          usage("app.mw.cache", {
            config: JSON.stringify({ ttl: 60 }),
          }),
        ]}
      />
    );

    const badge = screen.getByText("Subtree Policy");
    expect(screen.getAllByText("Subtree Policy")).toHaveLength(1);
    expect(badge.getAttribute("title")).toBe(
      "Applied by subtree policy from app.features.catalog"
    );

    const ownerLink = screen.getByText("app › features › catalog");
    expect(ownerLink.getAttribute("href")).toBe(
      "#element-app.features.catalog"
    );
    expect(screen.getByText("Audit").closest("a")?.getAttribute("href")).toBe(
      "#element-app.mw.audit"
    );
    expect(screen.getByText(/ttl/)).toBeTruthy();
    expect(container.querySelector("a a")).toBeNull();
  });

  it("drops every row of the previous element when reused for another", () => {
    // Nested owners that each require identity add one identityChecker gate
    // apiece, so one task's stack can hold the same id twice.
    const gate = (ownerId: string) =>
      usage("runner.middleware.task.identityChecker", {
        origin: "subtree",
        subtreeOwnerId: ownerId,
      });
    const { container, rerender } = render(
      <MiddlewareUsagesSection
        usages={[gate("app.outer"), gate("app.outer.inner")]}
      />
    );
    expect(container.querySelectorAll(".middleware-usages__item")).toHaveLength(
      2
    );

    // The detail pager reuses the same card for the next task.
    rerender(<MiddlewareUsagesSection usages={[usage("app.mw.audit")]} />);

    const rows = container.querySelectorAll(".middleware-usages__item");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("app.mw.audit");
    expect(screen.queryByText("Subtree Policy")).toBeNull();
  });

  it("shows the badge without a source line when the owner is unknown", () => {
    render(
      <MiddlewareUsagesSection
        usages={[usage("app.mw.audit", { origin: "subtree" })]}
      />
    );

    expect(screen.getByText("Subtree Policy")).toBeTruthy();
    expect(screen.queryByText(/Source:/)).toBeNull();
  });
});
