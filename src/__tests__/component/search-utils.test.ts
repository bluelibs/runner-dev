import {
  parseSearchQuery,
  elementMatchesParsed,
  treeNodeMatchesParsed,
} from "../../ui/src/components/Documentation/utils/search-utils";

// Test data
const testElements = [
  { id: "user-task-handler", tags: ["api", "handler", "user"] },
  { id: "resource-manager", tags: ["resource", "manager"] },
  { id: "event-emitter", tags: ["event", "emitter", "system"] },
  { id: "api-middleware", tags: ["api", "middleware"] },
  { id: "test-runner", tags: ["test", "runner"] },
  { id: "debug-logger", tags: ["debug", "logger", "system"] },
];

describe("Search Utils", () => {
  describe("parseSearchQuery", () => {
    test("should parse simple terms", () => {
      const result = parseSearchQuery("task");
      expect(result.isTagSearch).toBe(false);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].include).toEqual(["task"]);
      expect(result.groups[0].exclude).toEqual([]);
    });

    test("should parse comma-separated terms (AND)", () => {
      const result = parseSearchQuery("task,handler");
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].include).toEqual(["task", "handler"]);
    });

    test("should parse pipe-separated terms (OR)", () => {
      const result = parseSearchQuery("task|resource");
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].include).toEqual(["task"]);
      expect(result.groups[1].include).toEqual(["resource"]);
    });

    test("should parse exclude terms", () => {
      const result = parseSearchQuery("api,!test");
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].include).toEqual(["api"]);
      expect(result.groups[0].exclude).toEqual(["test"]);
    });

    test("should parse tag search", () => {
      const result = parseSearchQuery(":api,handler");
      expect(result.isTagSearch).toBe(true);
      expect(result.groups[0].include).toEqual(["api", "handler"]);
    });

    test("should parse complex query", () => {
      const result = parseSearchQuery("api,handler|resource,!test");
      expect(result.groups).toHaveLength(2);
      // First group: api AND handler
      expect(result.groups[0].include).toEqual(["api", "handler"]);
      expect(result.groups[0].exclude).toEqual([]);
      // Second group: resource AND NOT test
      expect(result.groups[1].include).toEqual(["resource"]);
      expect(result.groups[1].exclude).toEqual(["test"]);
    });
  });

  describe("elementMatchesParsed - ID Search", () => {
    test("should match single term", () => {
      const parsed = parseSearchQuery("task");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // user-task-handler
      expect(elementMatchesParsed(testElements[1], parsed)).toBe(false); // resource-manager
    });

    test("should match comma-separated terms with AND logic", () => {
      const parsed = parseSearchQuery("user,task");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // user-task-handler (has both)
      expect(elementMatchesParsed(testElements[4], parsed)).toBe(false); // test-runner (has neither)

      // Test with element that has both terms
      const parsed2 = parseSearchQuery("api,middleware");
      expect(elementMatchesParsed(testElements[3], parsed2)).toBe(true); // api-middleware (has both)
      expect(elementMatchesParsed(testElements[1], parsed2)).toBe(false); // resource-manager (has neither)
    });

    test("should match pipe-separated terms with OR logic", () => {
      const parsed = parseSearchQuery("task|resource");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // user-task-handler
      expect(elementMatchesParsed(testElements[1], parsed)).toBe(true); // resource-manager
      expect(elementMatchesParsed(testElements[2], parsed)).toBe(false); // event-emitter
    });

    test("should exclude terms with !", () => {
      const parsed = parseSearchQuery("handler,!test");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // user-task-handler
      expect(elementMatchesParsed(testElements[4], parsed)).toBe(false); // test-runner (has test)
    });

    test("should handle complex queries", () => {
      // (api AND middleware) OR (event AND emitter)
      const parsed = parseSearchQuery("api,middleware|event,emitter");
      expect(elementMatchesParsed(testElements[3], parsed)).toBe(true); // api-middleware
      expect(elementMatchesParsed(testElements[2], parsed)).toBe(true); // event-emitter
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(false); // user-task-handler
    });
  });

  describe("elementMatchesParsed - Tag Search", () => {
    test("should search in tags only", () => {
      const parsed = parseSearchQuery(":api");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // has api tag
      expect(elementMatchesParsed(testElements[3], parsed)).toBe(true); // has api tag
      expect(elementMatchesParsed(testElements[1], parsed)).toBe(false); // no api tag
    });

    test("should use AND logic for comma-separated tag terms", () => {
      const parsed = parseSearchQuery(":api,handler");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // has both api and handler tags
      expect(elementMatchesParsed(testElements[3], parsed)).toBe(false); // has api but not handler
    });

    test("should use OR logic for pipe-separated tag groups", () => {
      const parsed = parseSearchQuery(":api|system");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // has api
      expect(elementMatchesParsed(testElements[2], parsed)).toBe(true); // has system
      expect(elementMatchesParsed(testElements[1], parsed)).toBe(false); // has neither
    });

    test("should exclude tag terms", () => {
      const parsed = parseSearchQuery(":api,!middleware");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // has api, no middleware
      expect(elementMatchesParsed(testElements[3], parsed)).toBe(false); // has both api and middleware
    });
  });

  describe("treeNodeMatchesParsed", () => {
    const testNode = {
      label: "User Task Handler",
      elementId: "user-task-handler",
      element: { id: "user-task-handler", tags: ["api", "handler", "user"] },
    };

    test("should match node label", () => {
      const parsed = parseSearchQuery("User,Task");
      expect(treeNodeMatchesParsed(testNode, parsed)).toBe(true);
    });

    test("should match element ID", () => {
      const parsed = parseSearchQuery("user,handler");
      expect(treeNodeMatchesParsed(testNode, parsed)).toBe(true);
    });

    test("should search tags when in tag mode", () => {
      const parsed = parseSearchQuery(":api,handler");
      expect(treeNodeMatchesParsed(testNode, parsed)).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty query", () => {
      const parsed = parseSearchQuery("");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true);
    });

    test("should handle only exclude terms", () => {
      const parsed = parseSearchQuery("!test");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // no test
      expect(elementMatchesParsed(testElements[4], parsed)).toBe(false); // has test
    });

    test("should handle whitespace", () => {
      const parsed = parseSearchQuery("  api , handler  ");
      expect(parsed.groups[0].include).toEqual(["api", "handler"]);
    });

    test("should handle mixed case", () => {
      const parsed = parseSearchQuery("USER,TASK");
      expect(elementMatchesParsed(testElements[0], parsed)).toBe(true); // user-task-handler
    });
  });
});
