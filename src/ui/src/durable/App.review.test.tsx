import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { StudioApi } from "./api";
import { App } from "./App";
import { studioApi } from "./__tests__/studioApi";
import { executionDetail } from "./__tests__/fixtures";

const runtime = {
  id: "orders",
  title: "Orders",
  capabilities: { pause: true, resume: true, restart: true, state: true },
};
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
function restore(url: string) {
  act(() => {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}
function waiting(id: string) {
  return executionDetail({
    id,
    timeline: [
      {
        id: "wait",
        kind: "signal",
        label: "Approval",
        description: "Approval",
        state: "waiting",
        branchTaken: null,
        result: null,
        completedAt: null,
        wait: { signalId: "app.approval" },
      },
    ],
  });
}

test("history cannot send an old execution's signal draft to the new selection", async () => {
  window.history.replaceState(
    null,
    "",
    "/durable?runtimeId=orders&select=A&modal=signal"
  );
  const api = studioApi(waiting("A"));
  let receiveB: Parameters<StudioApi["subscribeExecution"]>[1] | undefined;
  api.subscribeExecution.mockImplementation((id, receive) => {
    if (id === "A") receive(waiting("A"));
    else receiveB = receive;
    return jest.fn();
  });
  render(<App api={api} runtime={runtime} />);
  const first = await screen.findByRole("dialog", { name: "Send signal" });
  fireEvent.change(within(first).getByRole("textbox", { name: "JSON input" }), {
    target: { value: '{"preparedFor":"A"}' },
  });
  restore("/durable?runtimeId=orders&select=B&modal=signal");
  const submit = within(screen.getByRole("dialog")).queryByRole("button", {
    name: "Send signal",
  });
  if (submit) {
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
  }
  expect(api.sendSignal).not.toHaveBeenCalled();
  act(() => receiveB?.(waiting("B")));
  const dialog = screen.getByRole("dialog", { name: "Send signal" });
  expect(
    within(dialog).getByRole("textbox", { name: "JSON input" })
  ).toHaveValue("{}");
  fireEvent.click(within(dialog).getByRole("button", { name: "Send signal" }));
  await waitFor(() =>
    expect(api.sendSignal).toHaveBeenCalledWith("B", "app.approval", {})
  );
});

test.each(["start", "restart"])(
  "a pending %s cannot rewrite another runtime's URL after unmount",
  async (operation) => {
    window.history.replaceState(null, "", "/durable?runtimeId=orders&select=A");
    const api = studioApi(executionDetail({ id: "A", status: "failed" }));
    let finish!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    if (operation === "start") api.startExecution.mockReturnValue(pending);
    else api.restartExecution.mockReturnValue(pending);
    const { unmount } = render(<App api={api} runtime={runtime} />);
    await screen.findByRole("button", { name: "Restart" });
    if (operation === "start") {
      fireEvent.keyDown(window, { key: "n" });
      const dialog = await screen.findByRole("dialog", {
        name: "Start execution",
      });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Start execution" })
      );
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Restart" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Restart execution",
        })
      );
    }
    unmount();
    window.history.replaceState(
      null,
      "",
      "/durable?runtimeId=finance&view=schedules"
    );
    const url = window.location.href;
    const reads = api.listExecutionPage.mock.calls.length;
    await act(async () => finish("orders-new-run"));
    expect(window.location.href).toBe(url);
    expect(api.listExecutionPage).toHaveBeenCalledTimes(reads);
  }
);

test("history replaces local confirmations with a single URL-backed dialog", async () => {
  window.history.replaceState(null, "", "/durable?runtimeId=orders&select=A");
  const api = studioApi(executionDetail({ id: "A" }));
  render(<App api={api} runtime={runtime} />);
  await screen.findByRole("button", { name: "Timeline · 0" });
  fireEvent.click(screen.getByText("Operate ▾"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel execution" }));
  restore("/durable?runtimeId=orders&select=A&modal=start");
  expect(await screen.findAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Start execution");
  expect(api.cancelExecution).not.toHaveBeenCalled();
});

test("history cannot stack a start dialog over an open schedule draft", async () => {
  window.history.replaceState(
    null,
    "",
    "/durable?runtimeId=orders&view=schedules"
  );
  render(<App api={studioApi()} runtime={runtime} />);
  const create = await screen.findByRole("button", { name: "New schedule" });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("New schedule");
  restore("/durable?runtimeId=orders&view=schedules&modal=start");
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Start execution");
});

test("a pending checkpoint reset cannot replace a selection restored by browser history", async () => {
  restore("/durable?runtimeId=orders&select=A");
  const api = studioApi(
    executionDetail({
      id: "A",
      status: "paused",
      historyRecorded: true,
      resettableSteps: ["validate"],
    })
  );
  let finish!: (branch: string) => void;
  api.resetExecution.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  render(
    <App
      api={api}
      runtime={{
        ...runtime,
        capabilities: { ...runtime.capabilities, reset: true },
      }}
    />
  );
  fireEvent.click(await screen.findByText("Operate ▾"));
  fireEvent.click(screen.getByRole("button", { name: "Reset to checkpoint" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Reason"), {
    target: { value: "Retry validation" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create branch" }));
  expect(api.resetExecution).toHaveBeenCalledTimes(1);
  expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  restore("/durable?runtimeId=orders&select=B");
  await act(async () => finish("branch-from-A"));
  expect(new URLSearchParams(window.location.search).get("select")).toBe("B");
  expect(screen.queryByRole("dialog")).toBeNull();
});
