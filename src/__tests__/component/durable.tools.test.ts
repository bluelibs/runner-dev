import {
  DURABLE_WORKFLOW_TAG_ID,
  findDurableDependencyId,
  getDurableWorkflowKeyFromTags,
  hasDurableWorkflowTag,
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
});
