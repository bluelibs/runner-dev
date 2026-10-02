/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApmPanel } from "./ApmPanel";
import { graphqlRequest } from "../../utils/graphqlClient";

jest.mock("../../utils/graphqlClient", () => ({ graphqlRequest: jest.fn() }));
const request = jest.mocked(graphqlRequest);
const snapshot = {
  enabled: true,
  storage: "sqlite",
  maxSamples: 10_000,
  retainedSamples: 5,
  windowMinutes: 30,
  scope: "all",
  oldestTimestampMs: 100_000,
  hooks: [
    {
      nodeId: "app.on-order",
      count: 3,
      failures: 0,
      errorRate: 0,
      meanMs: 20,
      p50Ms: 18,
      p95Ms: 25,
      p99Ms: 25,
      maxMs: 25,
    },
  ],
  tasks: [
    {
      nodeId: "app.checkout",
      count: 5,
      failures: 1,
      errorRate: 0.2,
      meanMs: 12,
      p50Ms: 10,
      p95Ms: 30,
      p99Ms: 30,
      maxMs: 30,
    },
  ],
};
const renderPanel = () =>
  render(<ApmPanel active={false} pollInterval={1000} refreshKey={0} />);
beforeEach(() => request.mockReset());

it("explains opt-in collection when disabled", async () => {
  request.mockResolvedValue({ live: { apm: { ...snapshot, enabled: false } } });
  renderPanel();
  expect(await screen.findByText(/Enable collection with/)).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("shows persisted metrics, small sample context, scope controls and task filtering", async () => {
  request.mockResolvedValue({ live: { apm: snapshot } });
  renderPanel();
  expect(await screen.findByText("SQLite · persisted")).toBeTruthy();
  expect(screen.getByText("Small sample · 5 calls")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "app.checkout" }).getAttribute("href")
  ).toBe("#element-app.checkout");
  fireEvent.click(screen.getByRole("button", { name: "Direct calls" }));
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(expect.any(String), {
      window: 30,
      scope: "direct",
    })
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "5" } });
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(expect.any(String), {
      window: 5,
      scope: "direct",
    })
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No tasks match your filter.")).toBeTruthy();
});

it("shows fetch failures instead of inventing zero metrics", async () => {
  request.mockRejectedValue(new Error("Network unavailable"));
  renderPanel();
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Network unavailable"
  );
});

it("separates hook calls and latency from delegated task metrics", async () => {
  request.mockResolvedValue({ live: { apm: snapshot } });
  renderPanel();
  const hooks = await screen.findByRole("button", { name: "Hooks · 3" });
  fireEvent.click(hooks);
  expect(
    screen.getByRole("link", { name: "app.on-order" }).getAttribute("href")
  ).toBe("#element-app.on-order");
  expect(screen.queryByRole("link", { name: "app.checkout" })).toBeNull();
  expect(screen.getByText("Highest hook p95")).toBeTruthy();
  expect(screen.getByText("3 calls", { exact: false })).toBeTruthy();
});
