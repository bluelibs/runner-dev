import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { StudioApi } from "./api";
import { App } from "./App";
import { execution, executionDetail } from "./__tests__/fixtures";
import { studioApi } from "./__tests__/studioApi";

const runtime = {
  id: "runtime-1",
  title: "Orders runtime",
  capabilities: { pause: true, resume: true, restart: true, state: true },
};
type Subscription = Parameters<StudioApi["subscribeExecution"]>;
const originalResizeObserver = global.ResizeObserver;

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  global.ResizeObserver = originalResizeObserver;
  window.history.replaceState(null, "", "/");
});

async function setup(selected = true) {
  window.history.replaceState(
    null,
    "",
    selected ? "/durable?select=run-1" : "/durable?view=executions"
  );
  const api = studioApi();
  const subscriptions = new Map<
    string,
    { onDetail: Subscription[1]; onError: Subscription[2]; stop: jest.Mock }
  >();
  api.subscribeExecution.mockImplementation((id, onDetail, onError) => {
    const stop = jest.fn();
    subscriptions.set(id, { onDetail, onError, stop });
    return stop;
  });
  api.listExecutionPage.mockResolvedValue({
    executions: [execution(), execution({ id: "run-2" })],
    total: 2,
    hasMore: false,
    nextCursor: null,
    nextOffset: null,
  });
  await act(async () => {
    render(<App api={api} runtime={runtime} />);
  });
  function subscription(id: string) {
    const current = subscriptions.get(id);
    if (!current) throw new Error(`Missing subscription for ${id}`);
    return current;
  }
  async function select(id: string) {
    fireEvent.click(
      await within(
        screen.getByRole("region", { name: "Executions" })
      ).findByRole("button", { name: new RegExp(id) })
    );
  }
  async function receive(id: string) {
    await act(async () => subscription(id).onDetail(executionDetail({ id })));
  }
  return { api, subscription, select, receive };
}

test("only shows the empty selection prompt when no execution is selected", async () => {
  const { select } = await setup(false);
  expect(screen.getByText("Select an execution")).toBeInTheDocument();
  await select("run-1");
  expect(screen.queryByText("Select an execution")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Loading execution…");
});

test("keeps the detail and active tab mounted while switching, with actions disabled", async () => {
  const { subscription, select, receive, api } = await setup();
  expect(screen.getByRole("status")).toHaveTextContent("Loading execution…");
  expect(screen.queryByText("Select an execution")).not.toBeInTheDocument();
  await receive("run-1");
  fireEvent.click(screen.getByRole("button", { name: "Data" }));
  const heading = screen.getByRole("heading", { name: "Input" });
  const pause = screen.getByRole("button", { name: "Pause" });
  expect(pause).toBeEnabled();

  await select("run-2");

  expect(subscription("run-1").stop).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("heading", { name: "Input" })).toBe(heading);
  expect(screen.queryByText("Select an execution")).not.toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(pause).toBeDisabled();
  pause.click();
  expect(api.pauseExecution).not.toHaveBeenCalled();

  await receive("run-2");

  expect(screen.getByRole("heading", { name: "Input" })).toBe(heading);
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(pause).toBeEnabled();
  await act(async () => fireEvent.click(pause));
  expect(api.pauseExecution).toHaveBeenCalledWith("run-2");
});

test("ignores late callbacks from a previous selection and recovers from load errors", async () => {
  const { subscription, select, receive } = await setup();
  await receive("run-1");
  await select("run-2");
  act(() => subscription("run-1").onError?.(new Error("Old failure")));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(() => subscription("run-2").onError?.(new Error("Run unavailable")));
  expect(screen.getByRole("alert")).toHaveTextContent("Run unavailable");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  expect(screen.queryByText("Select an execution")).not.toBeInTheDocument();

  await receive("run-2");
  await receive("run-1");

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const detail = screen.getByRole("group", { name: "Execution details" });
  expect(within(detail).getByText("run-2")).toBeInTheDocument();
  expect(within(detail).queryByText("run-1")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
});

test("shows an initial load failure without a selection prompt and resumes on the next update", async () => {
  const { subscription, receive } = await setup();
  act(() => subscription("run-1").onError?.("Connection failed"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not load execution."
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText("Select an execution")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Execution details" })).toBeNull();

  await receive("run-1");
  act(() => subscription("run-1").onError?.(new Error("Refresh failed")));
  expect(screen.getByRole("alert")).toHaveTextContent("Refresh failed");
  expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
  await receive("run-1");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
