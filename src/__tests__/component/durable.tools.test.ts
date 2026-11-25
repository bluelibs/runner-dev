import {
  DURABLE_EVENT_TAG_ID,
  DURABLE_WORKFLOW_TAG_ID,
  findDurableDependencyId,
  getDurableEventConfigFromTags,
  getDurableWorkflowKeyFromTags,
  getDurableWorkflowVersionFromTags,
  hasDurableEventTag,
  hasDurableWorkflowTag,
  isDurableEventTagId,
  isDurableWorkflowTagId,
} from "../../resources/models/durable.tools";

describe("durable.tools", () => {
  test("isDurableWorkflowTagId only matches the canonical id", () => {
    expect(isDurableWorkflowTagId(DURABLE_WORKFLOW_TAG_ID)).toBe(true);
    expect(isDurableWorkflowTagId("durable.workflow")).toBe(false);
    expect(isDurableWorkflowTagId("app.tags.other")).toBe(false);
    expect(isDurableWorkflowTagId(null)).toBe(false);
    expect(isDurableWorkflowTagId(undefined)).toBe(false);
  });

  test("hasDurableWorkflowTag supports string and object tag shapes", () => {
    expect(hasDurableWorkflowTag([DURABLE_WORKFLOW_TAG_ID])).toBe(true);
    expect(hasDurableWorkflowTag([{ id: DURABLE_WORKFLOW_TAG_ID }])).toBe(true);
    expect(
      hasDurableWorkflowTag([{ tag: { id: DURABLE_WORKFLOW_TAG_ID } }])
    ).toBe(true);
    expect(hasDurableWorkflowTag([{ id: "app.tags.other" }])).toBe(false);
    expect(hasDurableWorkflowTag(null)).toBe(false);
  });

  test("findDurableDependencyId returns the first durable dependency", () => {
    expect(
      findDurableDependencyId(["app.resources.cache", "app.durable.runtime"])
    ).toBe("app.durable.runtime");
    expect(findDurableDependencyId(["base.durable.shared"])).toBe(
      "base.durable.shared"
    );
    expect(findDurableDependencyId(["base-durable-sqlite"])).toBe(
      "base-durable-sqlite"
    );
    expect(findDurableDependencyId(["base-durable-postgres"])).toBe(
      "base-durable-postgres"
    );
    expect(findDurableDependencyId(["app.resources.db"])).toBeNull();
    expect(findDurableDependencyId(null)).toBeNull();
  });

  describe("getDurableWorkflowKeyFromTags", () => {
    test("returns null for null/undefined/empty input", () => {
      expect(getDurableWorkflowKeyFromTags(null)).toBeNull();
      expect(getDurableWorkflowKeyFromTags(undefined)).toBeNull();
      expect(getDurableWorkflowKeyFromTags([])).toBeNull();
    });

    test("returns null when no durable tag present", () => {
      expect(
        getDurableWorkflowKeyFromTags([{ id: "app.tags.other", config: null }])
      ).toBeNull();
    });

    test("returns null when durable tag has no config", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          { id: DURABLE_WORKFLOW_TAG_ID, config: null },
        ])
      ).toBeNull();
    });

    test("returns null when config has no key", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          { id: DURABLE_WORKFLOW_TAG_ID, config: "{}" },
        ])
      ).toBeNull();
    });

    test("returns the key when present", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          {
            id: DURABLE_WORKFLOW_TAG_ID,
            config: JSON.stringify({ key: "billing.payment" }),
          },
        ])
      ).toBe("billing.payment");
    });

    test("returns null for empty string key", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          {
            id: DURABLE_WORKFLOW_TAG_ID,
            config: JSON.stringify({ key: "" }),
          },
        ])
      ).toBeNull();
    });

    test("returns null for non-string key", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          {
            id: DURABLE_WORKFLOW_TAG_ID,
            config: JSON.stringify({ key: 42 }),
          },
        ])
      ).toBeNull();
    });

    test("handles malformed JSON gracefully", () => {
      expect(
        getDurableWorkflowKeyFromTags([
          { id: DURABLE_WORKFLOW_TAG_ID, config: "{not-json}" },
        ])
      ).toBeNull();
    });
  });

  describe("getDurableWorkflowVersionFromTags", () => {
    test("returns positive integer versions and ignores invalid values", () => {
      expect(getDurableWorkflowVersionFromTags(null)).toBeNull();
      expect(
        getDurableWorkflowVersionFromTags([
          {
            id: DURABLE_WORKFLOW_TAG_ID,
            config: JSON.stringify({ key: "orders", version: 2 }),
          },
        ])
      ).toBe(2);
      expect(
        getDurableWorkflowVersionFromTags([
          {
            id: DURABLE_WORKFLOW_TAG_ID,
            config: JSON.stringify({ key: "orders", version: 0 }),
          },
        ])
      ).toBeNull();
      expect(
        getDurableWorkflowVersionFromTags([
          { id: DURABLE_WORKFLOW_TAG_ID, config: "{bad" },
        ])
      ).toBeNull();
    });
  });

  describe("durableEvent helpers", () => {
    test("identifies durableEvent tags and extracts config metadata", () => {
      expect(isDurableEventTagId(DURABLE_EVENT_TAG_ID)).toBe(true);
      expect(isDurableEventTagId("custom.tags.durableEvent")).toBe(true);
      expect(isDurableEventTagId("app.tags.other")).toBe(false);
      expect(hasDurableEventTag([{ id: DURABLE_EVENT_TAG_ID }])).toBe(true);
      expect(hasDurableEventTag([{ id: "app.tags.other" }])).toBe(false);

      expect(
        getDurableEventConfigFromTags([
          {
            id: DURABLE_EVENT_TAG_ID,
            config: JSON.stringify({
              key: "orders.created",
              compensation: "required",
            }),
          },
        ])
      ).toEqual({
        enabled: true,
        key: "orders.created",
        compensation: "required",
      });

      expect(
        getDurableEventConfigFromTags([
          {
            id: DURABLE_EVENT_TAG_ID,
            config: JSON.stringify({ enabled: false }),
          },
        ])
      ).toEqual({
        enabled: false,
        key: null,
        compensation: null,
      });

      expect(
        getDurableEventConfigFromTags([
          { id: DURABLE_EVENT_TAG_ID, config: null },
        ])
      ).toEqual({ enabled: true, key: null, compensation: null });

      expect(
        getDurableEventConfigFromTags([
          { id: DURABLE_EVENT_TAG_ID, config: "{bad" },
        ])
      ).toEqual({ enabled: true, key: null, compensation: null });
    });
  });
});
