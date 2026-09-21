/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { LivePanel } from "./LivePanel";

const streamState = {
  liveData: null as null | Record<string, unknown>,
  error: null as string | null,
};

jest.mock("../hooks/useLiveStream", () => ({
  useLiveStream: () => ({
    liveData: streamState.liveData,
    error: streamState.error,
    connectionMode: "sse",
    isActive: true,
    setIsActive: jest.fn(),
    pollInterval: 1000,
    setPollInterval: jest.fn(),
    refresh: jest.fn(),
  }),
  MIN_POLL_INTERVAL_MS: 500,
  MAX_POLL_INTERVAL_MS: 5000,
}));

jest.mock("./live/RecentLogs", () => ({ RecentLogs: () => null }));
jest.mock("./live/RecentEvents", () => ({ RecentEvents: () => null }));
jest.mock("./live/RecentRuns", () => ({ RecentRuns: () => null }));
jest.mock("./live/TraceView", () => ({ TraceView: () => null }));

function liveDataStub() {
  return {
    memory: { heapUsed: 1, heapTotal: 2, rss: 3 },
    cpu: { usage: 0.1, loadAverage: 0.2 },
    eventLoop: { lag: 0.3 },
    gc: { collections: 1, duration: 0.4 },
    logs: [],
    emissions: [],
    errors: [],
    runs: [],
  };
}

describe("LivePanel header", () => {
  beforeEach(() => {
    streamState.liveData = null;
    streamState.error = null;
  });

  it("keeps the title visible while loading", () => {
    const { container } = render(
      React.createElement(LivePanel, { introspector: {} })
    );

    expect(screen.getByText("Live Telemetry")).toBeTruthy();
    expect(container.querySelector(".live-header h2")).not.toBeNull();
  });

  it("renders title and controls inline in one header row", () => {
    streamState.liveData = liveDataStub();
    const { container } = render(
      React.createElement(LivePanel, { introspector: {} })
    );

    const header = container.querySelector(".live-header");
    expect(header).not.toBeNull();
    expect(header?.querySelector("h2")?.textContent).toContain(
      "Live Telemetry"
    );
    const controls = header?.querySelector(".live-controls");
    expect(controls).not.toBeNull();
    expect(controls?.textContent).toContain("SSE");
    expect(controls?.textContent).toContain("Refresh");
  });
});
