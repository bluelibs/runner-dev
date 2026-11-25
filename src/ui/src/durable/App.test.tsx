import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { App } from "./App";
import { ApiError } from "./api";
import { executionDetail, timestamp, workflow } from "./__tests__/fixtures";
import { studioApi } from "./__tests__/studioApi";

const runtime = {
  id: "runtime-1",
  title: "Orders runtime",
  capabilities: {
    pause: true,
    resume: true,
    restart: true,
    state: true,
    command: true,
    reset: true,
    replay: true,
  },
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

function waitingDetail() {
  return executionDetail({
    timeline: [
      {
        id: "wait-payment",
        kind: "signal",
        label: "Wait for payment",
        description: "Payment event",
        state: "waiting",
        branchTaken: null,
        result: null,
        completedAt: null,
        wait: {
          signalId: "app.paid",
          timeoutAtMs: Date.parse(timestamp) + 60_000,
        },
      },
    ],
  });
}

test("starts a workflow with validated JSON and selects the new execution", async () => {
  const api = studioApi();
  render(<App api={api} runtime={runtime} />);
  await waitFor(() => expect(api.listExecutionPage).toHaveBeenCalled());
  fireEvent.keyDown(window, { key: "n" });
  const dialog = await screen.findByRole("dialog", { name: "Start execution" });
  fireEvent.change(within(dialog).getByRole("textbox"), {
    target: { value: "{" },
  });
  expect(
    within(dialog).getByRole("button", { name: "Start execution" })
  ).toBeDisabled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Example order" })
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Start execution" })
  );
  await waitFor(() =>
    expect(api.startExecution).toHaveBeenCalledWith("orders", {
      orderId: "order-1",
    })
  );
  await waitFor(() =>
    expect(api.subscribeExecution).toHaveBeenCalledWith(
      "new-run",
      expect.any(Function),
      expect.any(Function)
    )
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await screen.findByText("Started new-run.")).toBeInTheDocument();
  expect(api.listSchedules.mock.calls.length).toBeGreaterThan(1);
});

test("uses an observed wait to deliver a signal when workflow metadata has no signals", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi(waitingDetail());
  render(<App api={api} runtime={runtime} />);
  fireEvent.click(await screen.findByRole("button", { name: "Send app.paid" }));
  const dialog = screen.getByRole("dialog", { name: "Send signal" });
  expect(within(dialog).getByLabelText("Signal")).toHaveValue("app.paid");
  fireEvent.change(within(dialog).getByRole("textbox"), {
    target: { value: '{"amount":42}' },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Send signal" }));
  await waitFor(() =>
    expect(api.sendSignal).toHaveBeenCalledWith("run-1", "app.paid", {
      amount: 42,
    })
  );
  expect(await screen.findByText("Delivered app.paid.")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("requires confirmation before cancelling a selected execution", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi();
  render(<App api={api} runtime={runtime} />);
  await screen.findByRole("button", { name: "Timeline · 0" });
  fireEvent.click(screen.getByText("Operate ▾"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel execution" }));
  expect(api.cancelExecution).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Cancel execution" });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Cancel execution" })
  );
  await waitFor(() =>
    expect(api.cancelExecution).toHaveBeenCalledWith("run-1")
  );
  await waitFor(() =>
    expect(api.listExecutionPage.mock.calls.length).toBeGreaterThan(1)
  );
});

test("requires a reason and valid JSON for operator repairs", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi(waitingDetail());
  render(<App api={api} runtime={runtime} />);
  await screen.findByRole("button", { name: "Timeline · 1" });
  fireEvent.click(screen.getByText("Operate ▾"));
  fireEvent.click(screen.getByRole("button", { name: "Skip step" }));
  let dialog = screen.getByRole("dialog", { name: "Skip durable step" });
  expect(
    within(dialog).getByRole("button", { name: "Confirm skip" })
  ).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Reason"), {
    target: { value: "  Payment verified  " },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm skip" }));
  await waitFor(() =>
    expect(api.skipStep).toHaveBeenCalledWith(
      "run-1",
      "wait-payment",
      "Payment verified"
    )
  );
  await screen.findByText("Skipped wait-payment.");
  fireEvent.click(screen.getByRole("button", { name: "Edit state" }));
  dialog = screen.getByRole("dialog", { name: "Edit step state" });
  fireEvent.change(within(dialog).getByLabelText("Reason"), {
    target: { value: "Correct payment result" },
  });
  const editor = within(dialog)
    .getAllByRole("textbox")
    .find((element) => element.tagName === "TEXTAREA");
  if (!editor) throw new Error("Replacement result editor is missing");
  fireEvent.change(editor, { target: { value: "invalid JSON" } });
  expect(
    within(dialog).getByRole("button", { name: "Save state" })
  ).toBeDisabled();
  fireEvent.change(editor, { target: { value: '{"paid":true}' } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save state" }));
  await waitFor(() =>
    expect(api.editState).toHaveBeenCalledWith(
      "run-1",
      "wait-payment",
      { paid: true },
      "Correct payment result"
    )
  );
  expect(await screen.findByText("Updated wait-payment.")).toBeInTheDocument();
});

test("retries failed executions and switches selection to a fresh restart", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi(
    executionDetail({
      status: "failed",
      error: {
        message: "Payment failed",
        stepId: "charge",
        stack: "error stack",
      },
    })
  );
  render(<App api={api} runtime={runtime} />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Retry execution" })).getByRole(
      "button",
      { name: "Retry execution" }
    )
  );
  await waitFor(() => expect(api.retryExecution).toHaveBeenCalledWith("run-1"));
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Restart execution" })).getByRole(
      "button",
      { name: "Restart execution" }
    )
  );
  await waitFor(() =>
    expect(api.restartExecution).toHaveBeenCalledWith("run-1")
  );
  await waitFor(() =>
    expect(api.subscribeExecution).toHaveBeenLastCalledWith(
      "restarted-run",
      expect.any(Function),
      expect.any(Function)
    )
  );
  expect(
    await screen.findByText("Restarted as restarted-run.")
  ).toBeInTheDocument();
});

test("surfaces authentication failures as runtime unavailability", async () => {
  const api = studioApi();
  api.listWorkflowPage.mockRejectedValue(new ApiError(401, "Unauthorized"));
  api.listSchedules.mockRejectedValue(new ApiError(401, "Unauthorized"));
  render(<App api={api} runtime={runtime} />);
  expect(
    await screen.findByRole("heading", { name: "Runtime unavailable" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Back to documentation" })
  ).toHaveAttribute("href", "/docs");
  expect(api.startExecution).not.toHaveBeenCalled();
});

test("starts a selected workflow version from the multi-version StartModal", async () => {
  const versionedWorkflow = {
    ...workflow,
    version: 2,
    versions: [
      {
        version: 2,
        taskId: "app.ordersV2",
        title: "Order fulfillment",
        description: "Latest fulfillment",
        signals: [],
        commands: [],
        presets: [{ name: "v2 preset", payload: { orderId: "order-v2" } }],
      },
      {
        version: 1,
        taskId: "app.ordersV1",
        title: "Order fulfillment",
        description: "Legacy fulfillment",
        signals: [],
        commands: [],
        presets: [{ name: "v1 preset", payload: { orderId: "order-v1" } }],
      },
    ],
  };
  const api = studioApi();
  api.listWorkflowPage.mockResolvedValue({
    workflows: [versionedWorkflow],
    total: 1,
    nextCursor: null,
  });
  api.getWorkflow.mockResolvedValue(versionedWorkflow);
  render(<App api={api} runtime={runtime} />);
  await waitFor(() => expect(api.listExecutionPage).toHaveBeenCalled());

  fireEvent.click(screen.getByRole("button", { name: "+ Start execution" }));
  const startDialog = await screen.findByRole("dialog", {
    name: "Start execution",
  });
  fireEvent.change(within(startDialog).getByLabelText("Version"), {
    target: { value: "1" },
  });
  fireEvent.click(
    within(startDialog).getByRole("button", { name: "Start execution" })
  );
  await waitFor(() =>
    expect(api.startExecution).toHaveBeenCalledWith(
      "orders",
      { orderId: "order-v1" },
      1
    )
  );
});

test("sends tracked commands and opens ResetDialog from Timeline Reset before", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const versionedWorkflow = {
    ...workflow,
    version: 2,
    commands: [
      {
        taskKey: "orders.update-address",
        title: "Update address",
        description: "Change delivery city",
      },
    ],
    versions: [
      {
        version: 2,
        taskId: "app.ordersV2",
        title: "Order fulfillment",
        description: "Latest fulfillment",
        signals: [],
        commands: [
          {
            taskKey: "orders.update-address",
            title: "Update address",
            description: "Change delivery city",
          },
        ],
        presets: [{ name: "v2 preset", payload: { orderId: "order-v2" } }],
      },
    ],
  };
  const api = studioApi(
    executionDetail({
      status: "paused",
      workflowVersion: 2,
      historyRecorded: true,
      resettableSteps: ["validate"],
      history: [
        {
          stepId: "validate",
          kind: "step",
          startedOrder: 1,
          completedOrder: 1,
        },
      ],
      timeline: [
        {
          id: "validate",
          kind: "step",
          label: "validate",
          description: "Persisted workflow step.",
          state: "completed",
          branchTaken: null,
          result: { ok: true },
          completedAt: timestamp,
          resettable: true,
          wait: null,
        },
      ],
    })
  );
  api.listWorkflowPage.mockResolvedValue({
    workflows: [versionedWorkflow],
    total: 1,
    nextCursor: null,
  });
  api.getWorkflow.mockResolvedValue(versionedWorkflow);
  render(<App api={api} runtime={runtime} />);

  // Send tracked command on live paused execution
  fireEvent.click(await screen.findByRole("button", { name: "Send command" }));
  const commandDialog = await screen.findByRole("dialog", {
    name: "Send command",
  });
  fireEvent.change(
    within(commandDialog).getByPlaceholderText("cmd-request-123"),
    { target: { value: "req-42" } }
  );
  fireEvent.click(
    within(commandDialog).getByRole("button", { name: "Send command" })
  );
  await waitFor(() =>
    expect(api.sendCommand).toHaveBeenCalledWith(
      "run-1",
      "orders.update-address",
      {},
      { idempotencyKey: "req-42" }
    )
  );
  expect(
    await screen.findByText("Command orders.update-address completed.")
  ).toBeInTheDocument();

  // Inline Timeline "Reset before" opens ResetDialog with step preselected
  fireEvent.click(screen.getByRole("button", { name: "Reset before" }));
  const resetDialog = await screen.findByRole("dialog", {
    name: "Reset to checkpoint",
  });
  fireEvent.change(within(resetDialog).getByLabelText("Reason"), {
    target: { value: "Re-run settlement" },
  });
  fireEvent.click(
    within(resetDialog).getByRole("button", { name: "Create branch" })
  );
  await waitFor(() =>
    expect(api.resetExecution).toHaveBeenCalledWith(
      "run-1",
      "validate",
      "Re-run settlement",
      undefined
    )
  );
  expect(
    await screen.findByText("Branched as branch-run.")
  ).toBeInTheDocument();
});

test("displays checkpoint branch lineage, retention schedule and collected history guardrails", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi(
    executionDetail({
      status: "completed",
      workflowVersion: 2,
      resetFromExecutionId: "source-run-0",
      resetBeforeStep: "settle",
      resetReason: "Gateway fix",
      historyRecorded: true,
      historyCollectedAt: timestamp,
      retention: {
        onComplete: "delete",
        receipts: { afterMs: 86_400_000 },
        historyCollectAt: timestamp,
        receiptExpireAt: timestamp,
      },
      result: { receipt: "RCPT-1" },
    })
  );
  render(<App api={api} runtime={runtime} />);

  expect(await screen.findByText(/History collected on/)).toBeInTheDocument();
  expect(screen.getByText(/Branched from/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restart" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Data" }));
  expect(await screen.findByText("Retention")).toBeInTheDocument();
  expect(screen.getByText("Delete immediately")).toBeInTheDocument();
  expect(screen.getByText("After 1d")).toBeInTheDocument();
});
