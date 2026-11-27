import { graphql } from "graphql";
import { schema } from "../../schema";
import { buildLogMatcher } from "../../resources/live/entryMatchers";
import type { ErrorEntry, LogQueryOptions } from "../../resources/live/types";

test("groups retained errors by source, message, type and throwing frame, independent of correlation and sequence", async () => {
  const base: ErrorEntry = {
    sourceId: "app.checkout",
    sourceKind: "TASK",
    message: "timeout",
    timestampMs: 101,
    sequence: 1,
  };
  const entries = [
    {
      ...base,
      stack: "Error: timeout\n    at charge (pay.ts:5:2)\n    at first",
      correlationId: "one",
    },
    {
      ...base,
      sequence: 2,
      timestampMs: 100,
      stack: "Error: timeout\n    at charge (pay.ts:5:2)\n    at second",
      correlationId: "two",
    },
    {
      ...base,
      sequence: 3,
      stack: "Error: timeout\n    at refund (pay.ts:9:2)",
    },
    { ...base, sequence: 4, sourceKind: "HOOK" },
    { ...base, sequence: 5 },
  ];
  const contextValue = {
    live: {
      getErrors: () => entries,
      getLogs: () => [],
      historyPersisted: true,
    },
  };
  const read = (id?: string) =>
    graphql({
      schema,
      contextValue,
      variableValues: { id },
      source: `query($id: ID) {
    live { historyPersisted errorGroups(id: $id) { id count firstSeenMs lastSeenMs latest { sequence } occurrences(last: 1) { sequence correlationId } } }
  }`,
    });
  const result = await read();
  expect(result.errors).toBeUndefined();
  const groups = result.data?.live as {
    historyPersisted: boolean;
    errorGroups: { id: string; count: number }[];
  };
  expect(groups.historyPersisted).toBe(true);
  expect(groups.errorGroups.map((g) => g.count)).toEqual([1, 1, 1, 2]);
  const group = groups.errorGroups[3];
  expect(group).toMatchObject({
    firstSeenMs: 100,
    lastSeenMs: 101,
    latest: { sequence: 2 },
    occurrences: [{ sequence: 2, correlationId: "two" }],
  });
  expect((await read(group.id)).data?.live).toMatchObject({
    errorGroups: [group],
  });
  entries.splice(0, 1);
  expect((await read(group.id)).data?.live).toMatchObject({
    errorGroups: [{ count: 1 }],
  });
});

test("searches structured data before applying a page limit and groups logger-only errors", async () => {
  const old = {
    level: "critical" as const,
    sourceId: "checkout",
    message: "Timed out",
    data: { region: "north" },
    correlationId: "trace-123",
    sequence: 1,
    timestampMs: 1,
  };
  const logs = [
    old,
    { ...old, sequence: 2, data: { region: "south" } },
    { ...old, sequence: 3, level: "info" as const },
  ];
  const getLogs = (options: LogQueryOptions) => {
    const matches = logs.filter(buildLogMatcher(options));
    return options.last ? matches.slice(-options.last) : matches;
  };
  const response = await graphql({
    schema,
    contextValue: { live: { getLogs, getErrors: () => [] } },
    source: `{
    live { logs(last:1,filter:{search:"NoRtH check TRACE-123",levels:[critical]}) { sequence }
    errorGroups(search:"north") { count latest { sourceKind } occurrences { sequence } } }
  }`,
  });
  expect(response.errors).toBeUndefined();
  expect(response.data?.live).toEqual({
    logs: [{ sequence: 1 }],
    errorGroups: [
      {
        count: 2,
        latest: { sourceKind: "LOG" },
        occurrences: [{ sequence: 2 }, { sequence: 1 }],
      },
    ],
  });
});

test("normalizes UUIDs and pairs each correlated exception with at most one logged copy", async () => {
  const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const error = {
    sourceKind: "TASK",
    sourceId: "checkout",
    message: "Order " + a + " failed",
    sequence: 2,
    timestampMs: 10,
    correlationId: "request-1",
  };
  const log = {
    sourceId: error.sourceId,
    level: "error",
    message: error.message,
    sequence: 1,
    timestampMs: 10,
    correlationId: error.correlationId,
  };
  const response = await graphql({
    schema,
    contextValue: {
      live: {
        getErrors: () => [
          error,
          {
            ...error,
            sequence: 4,
            message: "Order " + b + " failed",
            correlationId: "request-2",
          },
        ],
        getLogs: () => [log, { ...log, sequence: 3 }],
      },
    },
    source: `{live{errorGroups { count latest { sourceKind } occurrences { sequence } }}}`,
  });
  expect(response.errors).toBeUndefined();
  expect(response.data?.live).toMatchObject({
    errorGroups: [
      {
        count: 2,
        latest: { sourceKind: "TASK" },
        occurrences: [{ sequence: 4 }, { sequence: 2 }],
      },
      {
        count: 1,
        latest: { sourceKind: "LOG" },
        occurrences: [{ sequence: 3 }],
      },
    ],
  });
});

test("paired log metadata remains searchable and distinct exception types at the same frame remain separate", async () => {
  const entry = {
    sourceId: "charge",
    message: "invalid",
    timestampMs: 1,
    correlationId: "order-1",
  };
  const stack = (name: string) => name + ": invalid\n    at charge (pay.ts:7)";
  const contextValue = {
    live: {
      getErrors: () => [
        {
          ...entry,
          sourceKind: "TASK",
          sequence: 1,
          stack: stack("TypeError"),
        },
      ],
      getLogs: () =>
        ["RangeError", "TypeError"].map((name, i) => ({
          ...entry,
          level: "error",
          sequence: 2 + i,
          data: {
            region: name === "TypeError" ? "north" : "south",
            error: { stack: stack(name) },
          },
        })),
    },
  };
  const result = await graphql({
    schema,
    contextValue,
    source: `{live{
    north:errorGroups(search:"north") { count latest {sequence} }
    south:errorGroups(search:"south") { count latest {sequence} }
  }}`,
  });
  expect(result.errors).toBeUndefined();
  expect(result.data?.live).toEqual({
    north: [{ count: 1, latest: { sequence: 1 } }],
    south: [{ count: 1, latest: { sequence: 2 } }],
  });
});
