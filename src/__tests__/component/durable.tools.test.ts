import {
  DURABLE_WORKFLOW_TAG_ID,
  findDurableDependencyId,
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
});
