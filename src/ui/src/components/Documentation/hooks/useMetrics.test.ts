/** @jest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { graphqlRequest } from "../utils/graphqlClient";
import { useMetrics } from "./useMetrics";

jest.mock("../utils/graphqlClient", () => ({
  graphqlRequest: jest.fn(),
}));

const graphqlRequestMock = graphqlRequest as jest.MockedFunction<
  typeof graphqlRequest
>;

describe("useMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).__DOCS_PROPS__;
  });

  it("aggregates throughput, latency, error counts, and activity heatmap from live data", async () => {
    const now = Date.now();

    graphqlRequestMock.mockResolvedValue({
      live: {
        logs: [
          {
            timestampMs: now - 10_000,
            level: "info",
            message: "recent log",
          },
        ],
        errors: [
          {
            timestampMs: now - 20_000,
            sourceId: "task.alpha",
            sourceKind: "TASK",
            message: "failed",
            sourceResolved: { id: "task.alpha" },
          },
          {
            timestampMs: now - 15_000,
            sourceId: "task.alpha",
            sourceKind: "TASK",
            message: "failed again",
            sourceResolved: { id: "task.alpha" },
          },
        ],
        runs: [
          {
            timestampMs: now - 20_000,
            nodeId: "task.alpha",
            ok: true,
            durationMs: 10,
          },
          {
            timestampMs: now - 19_000,
            nodeId: "task.alpha",
            ok: false,
            durationMs: 40,
          },
          {
            timestampMs: now - 18_000,
            nodeId: "task.beta",
            ok: true,
            durationMs: 70,
          },
        ],
      },
    } as any);

    const { result } = renderHook(() => useMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.throughput.some((point) => point.success === 2)).toBe(
      true
    );
    expect(result.current.throughput.some((point) => point.error === 1)).toBe(
      true
    );
    expect(
      result.current.latency.some(
        (point) => point.p50 === 40 && point.p95 === 40 && point.p99 === 40
      )
    ).toBe(true);
    expect(result.current.errorByTask).toEqual([
      {
        taskId: "task.alpha",
        errors: 2,
      },
    ]);

    const logDate = new Date(now - 10_000);
    expect(result.current.heatmap[logDate.getDay()][logDate.getHours()]).toBe(
      1
    );
  });

  it("keeps the hook stable when telemetry fetching fails", async () => {
    graphqlRequestMock.mockRejectedValue(new Error("network wobble"));

    const { result } = renderHook(() => useMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.throughput).toEqual([]);
    expect(result.current.latency).toEqual([]);
    expect(result.current.errorByTask).toEqual([]);
    expect(result.current.heatmap).toHaveLength(7);
  });

  it("stays inert in catalog mode", async () => {
    (window as any).__DOCS_PROPS__ = {
      mode: "catalog",
    };

    const { result } = renderHook(() => useMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(graphqlRequestMock).not.toHaveBeenCalled();
    expect(result.current.throughput).toEqual([]);
    expect(result.current.latency).toEqual([]);
    expect(result.current.errorByTask).toEqual([]);
  });
});
