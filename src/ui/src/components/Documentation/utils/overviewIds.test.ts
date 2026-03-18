import { formatOverviewDisplayId, getOverviewDisplayId } from "./overviewIds";

describe("overviewIds", () => {
  test("shows the nearest registered owner and the leaf for direct ancestry", () => {
    expect(
      formatOverviewDisplayId(
        {
          id: "enhanced-app.catalog.hooks.catalogOnEnabled",
          registeredBy: "enhanced-app.catalog",
        },
        [{ id: "enhanced-app.catalog", registeredBy: null }]
      )
    ).toBe("catalog>catalogOnEnabled");
  });

  test("collapses deeper ancestry to ellipsis, nearest owner, and leaf", () => {
    expect(
      formatOverviewDisplayId(
        {
          id: "enhanced-app.catalog.hooks.catalogOnEnabled",
          registeredBy: "enhanced-app.features.catalog",
        },
        [
          {
            id: "enhanced-app.features.catalog",
            registeredBy: "enhanced-app.features",
          },
          { id: "enhanced-app.features", registeredBy: "enhanced-app" },
          { id: "enhanced-app", registeredBy: null },
        ]
      )
    ).toBe("...>catalog>catalogOnEnabled");
  });

  test("uses registered parents for resources too", () => {
    expect(
      formatOverviewDisplayId(
        {
          id: "enhanced-app.features.catalog",
          registeredBy: "enhanced-app.features",
        },
        [
          { id: "enhanced-app.features", registeredBy: "enhanced-app" },
          { id: "enhanced-app", registeredBy: null },
        ]
      )
    ).toBe("...>features>catalog");
  });

  test("falls back to last two meaningful segments when no owner exists", () => {
    expect(
      formatOverviewDisplayId(
        { id: "enhanced-app.events.catalog.itemSynced", registeredBy: null },
        []
      )
    ).toBe("...>catalog>itemSynced");
  });

  test("keeps two-part canonical ids readable without extra ellipsis", () => {
    expect(
      formatOverviewDisplayId(
        { id: "enhanced-app.mainOne", registeredBy: null },
        []
      )
    ).toBe("enhanced-app>mainOne");
  });

  test("keeps singular namespace segments because only plural collection buckets are synthetic", () => {
    expect(
      formatOverviewDisplayId(
        { id: "enhanced-app.catalog.hook.isolationBoundary", registeredBy: null },
        []
      )
    ).toBe("...>hook>isolationBoundary");
  });

  test("returns full ancestry segments for expandable ids", () => {
    expect(
      getOverviewDisplayId(
        {
          id: "enhanced-app.catalog.hooks.isolationBoundary",
          registeredBy: "enhanced-app.features.catalog",
        },
        [
          {
            id: "enhanced-app.features.catalog",
            registeredBy: "enhanced-app.features",
          },
          { id: "enhanced-app.features", registeredBy: "enhanced-app" },
          { id: "enhanced-app", registeredBy: null },
        ]
      )
    ).toEqual({
      collapsedSegments: ["catalog", "isolationBoundary"],
      fullSegments: ["enhanced-app", "features", "catalog", "isolationBoundary"],
      hasHiddenAncestors: true,
    });
  });

  test("collapses fallback paths to the last two meaningful segments while keeping the full path for expansion", () => {
    expect(
      getOverviewDisplayId(
        {
          id: "enhanced-superapp.catalog.hooks.catalogOnEnabled",
          registeredBy: null,
        },
        []
      )
    ).toEqual({
      collapsedSegments: ["catalog", "catalogOnEnabled"],
      fullSegments: ["enhanced-superapp", "catalog", "catalogOnEnabled"],
      hasHiddenAncestors: true,
    });
  });
});
