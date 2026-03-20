import { computeSchemaDefaultValue } from "./schemaDefaults";

describe("computeSchemaDefaultValue", () => {
  test("autopopulates runner Date fields as ISO strings", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-20T12:34:56.789Z"));

    expect(
      computeSchemaDefaultValue({
        type: "string",
        format: "date-time",
        "x-runner-runtime-type": "Date",
      })
    ).toBe("2026-03-20T12:34:56.789Z");

    jest.useRealTimers();
  });

  test("uses a friendly fallback for plain strings", () => {
    expect(
      computeSchemaDefaultValue({
        type: "string",
      }, { fieldName: "statusLabel" })
    ).toBe("status-label-sample");
  });

  test("autopopulates id-like fields with a friendly random id", () => {
    const camelCaseId = computeSchemaDefaultValue(
      { type: "string" },
      { fieldName: "taskId" }
    );
    const snakeCaseId = computeSchemaDefaultValue(
      { type: "string" },
      { fieldName: "task_id" }
    );

    expect(camelCaseId).toMatch(/^[a-z0-9]{32}$/);
    expect(snakeCaseId).toMatch(/^[a-z0-9]{32}$/);
    expect(camelCaseId).not.toBe(snakeCaseId);
  });

  test("autopopulates friendly values for a few common string fields", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-20T12:34:56.789Z"));

    expect(
      computeSchemaDefaultValue(
        { type: "string", format: "email" },
        { fieldName: "authorEmail" }
      )
    ).toBe("user@example.com");

    expect(
      computeSchemaDefaultValue(
        { type: "string", format: "uri" },
        { fieldName: "homepageUrl" }
      )
    ).toBe("https://example.com");

    expect(
      computeSchemaDefaultValue({ type: "string" }, { fieldName: "title" })
    ).toBe("Sample Title");

    expect(
      computeSchemaDefaultValue({ type: "string" }, { fieldName: "updatedAt" })
    ).toBe("2026-03-20T12:34:56.789Z");

    jest.useRealTimers();
  });

  test("autopopulates friendly values for string arrays", () => {
    expect(
      computeSchemaDefaultValue(
        {
          type: "array",
          items: { type: "string" },
        },
        { fieldName: "changedSkus" }
      )
    ).toEqual(["sku-demo-001", "sku-demo-002"]);

    expect(
      computeSchemaDefaultValue(
        {
          type: "array",
          items: { type: "string" },
        },
        { fieldName: "tags" }
      )
    ).toEqual(["tag-sample-1", "tag-sample-2"]);
  });

  test("uses field-aware defaults for nested object properties", () => {
    const value = computeSchemaDefaultValue({
      type: "object",
      properties: {
        userId: { type: "string" },
        profile: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
          },
        },
      },
    }) as {
      userId: string;
      profile: { email: string };
    };

    expect(value.userId).toMatch(/^[a-z0-9]{32}$/);
    expect(value.profile.email).toBe("user@example.com");
  });
});
