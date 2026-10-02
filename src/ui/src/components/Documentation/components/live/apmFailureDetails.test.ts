import {
  loadFailureDetails,
  loadRetainedTrace,
  type FailureSelection,
} from "./apmFailureDetails";
import { graphqlRequest } from "../../utils/graphqlClient";

jest.mock("../../utils/graphqlClient", () => ({ graphqlRequest: jest.fn() }));
const request = jest.mocked(graphqlRequest);
const selection: FailureSelection = {
  nodeId: "app.checkout",
  nodeKind: "TASK",
  scope: "all",
  windowMinutes: 1,
  endTimestampMs: 100_000,
};
const run = {
  sequence: 5,
  timestampMs: 90_000,
  nodeId: "app.checkout",
  nodeKind: "TASK",
  ok: false,
  error: "Declined",
  correlationId: "order-1",
  parentId: "app.on-order",
};
const error = {
  sequence: 4,
  timestampMs: 89_999,
  sourceId: "app.checkout",
  sourceKind: "TASK",
  message: "Declined",
  stack: "Error: Declined\n at checkout",
  correlationId: "order-1",
};
beforeEach(() => request.mockReset());

it("joins retained failure stacks by correlation and preserves one row per execution", async () => {
  request.mockResolvedValue({ live: { runs: [run], errors: [error] } });
  expect((await loadFailureDetails(selection)).failures).toEqual([
    {
      sequence: 5,
      timestampMs: 90_000,
      message: "Declined",
      stack: error.stack,
      correlationId: "order-1",
    },
  ]);
  expect(request).toHaveBeenCalledWith(expect.any(String), {
    limit: 50,
    runs: { nodeIds: [selection.nodeId], nodeKinds: ["TASK"], ok: false },
    errors: { sourceIds: [selection.nodeId], sourceKinds: ["TASK"] },
  });
});

it("applies the selected window and direct/nested scope", async () => {
  request.mockResolvedValue({
    live: {
      runs: [
        run,
        { ...run, sequence: 6, parentId: null, correlationId: "direct" },
        { ...run, sequence: 7, timestampMs: 39_999 },
        { ...run, sequence: 8, timestampMs: 100_001 },
      ],
      errors: [error],
    },
  });
  expect(
    (await loadFailureDetails({ ...selection, scope: "direct" })).failures.map(
      (failure) => failure.sequence
    )
  ).toEqual([6]);
  expect(
    (await loadFailureDetails({ ...selection, scope: "nested" })).failures.map(
      (failure) => failure.sequence
    )
  ).toEqual([5]);
});

it("can show an error whose run expired, but cannot infer its call scope", async () => {
  request.mockResolvedValue({ live: { runs: [], errors: [error] } });
  expect((await loadFailureDetails(selection)).failures).toMatchObject([
    { message: "Declined", correlationId: "order-1" },
  ]);
  expect(
    (await loadFailureDetails({ ...selection, scope: "direct" })).failures
  ).toEqual([]);
});

it("keeps failures without correlation IDs and handles expired details", async () => {
  request.mockResolvedValueOnce({
    live: { runs: [{ ...run, correlationId: null }], errors: [] },
  });
  expect((await loadFailureDetails(selection)).failures).toMatchObject([
    { message: "Declined", correlationId: null },
  ]);
  request.mockResolvedValueOnce({ live: { runs: [], errors: [] } });
  expect((await loadFailureDetails(selection)).failures).toEqual([]);
});

it("loads all trace categories through a narrow correlation filter", async () => {
  const trace = {
    logs: [{ message: "payment failed" }],
    emissions: [],
    errors: [error],
    runs: [run],
  };
  request.mockResolvedValue({ live: trace });
  expect(await loadRetainedTrace("order-1")).toBe(trace);
  expect(request).toHaveBeenCalledWith(expect.stringContaining("last: 200"), {
    ids: ["order-1"],
  });
});

it("reports a full retained window and permits loading more than 50 failures", async () => {
  const runs = Array.from({ length: 75 }, (_, i) => ({
    ...run,
    sequence: i + 1,
    correlationId: `c${i}`,
  }));
  request.mockResolvedValueOnce({
    live: { runs: runs.slice(-50), errors: [] },
  });
  expect((await loadFailureDetails(selection)).hasMore).toBe(true);
  request.mockResolvedValueOnce({ live: { runs, errors: [] } });
  const page = await loadFailureDetails(selection, 100);
  expect(page.failures).toHaveLength(75);
  expect(page.hasMore).toBe(false);
  expect(request).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({ limit: 100 })
  );
});
