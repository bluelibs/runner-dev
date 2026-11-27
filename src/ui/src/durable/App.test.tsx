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

test("surfaces authentication failures separately from transient errors", async () => {
  const api = studioApi();
  api.listWorkflowPage.mockRejectedValue(new ApiError(401, "Unauthorized"));
  api.listSchedules.mockRejectedValue(new ApiError(401, "Unauthorized"));
  render(<App api={api} runtime={runtime} />);
  expect(
    await screen.findByRole("heading", { name: "Authentication required" })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Back to documentation" })
  ).toHaveAttribute("href", "/docs");
  expect(api.startExecution).not.toHaveBeenCalled();
});

test("blocks duplicate execution mutations while leaving data inspection available and recovers after rejection", async () => {
  window.history.replaceState(null, "", "/durable?select=run-1");
  const api = studioApi();
  let reject!: (error: Error) => void;
  api.pauseExecution.mockReturnValueOnce(
    new Promise<void>((_resolve, no) => {
      reject = no;
    })
  );
  render(<App api={api} runtime={runtime} />);
  const pause = await screen.findByRole("button", { name: "Pause" });
  fireEvent.click(pause);
  fireEvent.click(pause);
  expect(api.pauseExecution).toHaveBeenCalledTimes(1);
  expect(pause).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Data" }));
  expect(screen.getByRole("heading", { name: "Input" })).toBeInTheDocument();
  reject(new Error("Pause rejected"));
  await waitFor(() => expect(pause).toBeEnabled());
  expect(await screen.findByText("Pause: Pause rejected")).toBeInTheDocument();
  fireEvent.click(pause);
  await waitFor(() => expect(api.pauseExecution).toHaveBeenCalledTimes(2));
});

test("keeps execution errors visible when auxiliary reads succeed and allows a local retry", async () => {
  const api = studioApi();
  api.listExecutionPage.mockRejectedValue(new ApiError(503, "History offline"));
  render(<App api={api} runtime={runtime} />);
  expect(await screen.findByText("Executions unavailable")).toBeInTheDocument();
  expect(screen.queryByText("Runtime unavailable")).toBeNull();
  expect(screen.queryByText("No failures in view")).toBeNull();
  expect(screen.getByRole("button", { name: "Schedules" })).toBeEnabled();
  api.listExecutionPage.mockResolvedValue({
    executions: [],
    total: 0,
    nextCursor: null,
    nextOffset: null,
    hasMore: false,
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry executions" }));
  await screen.findByText("No finished runs in view");
  expect(screen.queryByText("Executions unavailable")).toBeNull();
});

test("isolates schedule failures, retries them, and keeps a successful save successful when refreshing fails", async () => {
  const api = studioApi();
  api.listSchedules.mockRejectedValue(new Error("Schedule store offline"));
  render(<App api={api} runtime={runtime} />);
  expect(await screen.findByText("Schedules unavailable")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Workflow health" })
  ).toBeInTheDocument();
  api.listSchedules.mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Retry schedules" }));
  await waitFor(() =>
    expect(screen.queryByText("Schedules unavailable")).toBeNull()
  );
  fireEvent.click(screen.getByRole("button", { name: "Schedules" }));
  fireEvent.click(await screen.findByRole("button", { name: "New schedule" }));
  const dialog = screen.getByRole("dialog", { name: "New schedule" });
  const save = within(dialog).getByRole("button", { name: "Create schedule" });
  await waitFor(() => expect(save).toBeEnabled());
  api.listSchedules.mockRejectedValue(new Error("Refresh offline"));
  fireEvent.click(save);
  expect(await screen.findByText("Schedule created.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByText("Schedules unavailable")).toBeInTheDocument();
  expect(api.createSchedule).toHaveBeenCalledTimes(1);
});

test("suppresses global shortcuts inside a schedule dialog", async () => {
  render(<App api={studioApi()} runtime={runtime} />);
  fireEvent.click(screen.getByRole("button", { name: "Schedules" }));
  fireEvent.click(await screen.findByRole("button", { name: "New schedule" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
    key: "n",
  });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("New schedule");
});

test.each(["failed", "cancelled", "completed"] as const)(
  "shows accurate result state for %s executions",
  async (status) => {
    window.history.replaceState(null, "", "/durable?select=run-1");
    render(
      <App
        api={studioApi(executionDetail({ status, result: null }))}
        runtime={runtime}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Data" }));
    expect(
      screen.queryByText("No result yet — the workflow is still running.")
    ).toBeNull();
    expect(
      screen.getByText(`No result recorded. Execution status: ${status}.`)
    ).toBeInTheDocument();
  }
);

test("shows rejected start input inside the focused dialog and retains the editable draft", async () => {
  const api = studioApi();
  api.startExecution.mockRejectedValueOnce(
    new ApiError(400, "Order ID required")
  );
  render(<App api={api} runtime={runtime} />);
  await waitFor(() => expect(api.listWorkflowPage).toHaveBeenCalled());
  fireEvent.keyDown(window, { key: "n" });
  const dialog = await screen.findByRole("dialog", { name: "Start execution" });
  const input = within(dialog).getByRole("textbox", { name: "JSON input" });
  fireEvent.change(input, { target: { value: '{"draft":42}' } });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Start execution" })
  );
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Order ID required"
  );
  expect(input).toHaveValue('{"draft":42}');
  expect(dialog).toBeInTheDocument();
});

test("groups concurrent execution and schedule failures and retries only the chosen feed", async () => {
  const api = studioApi();
  api.listExecutionPage.mockRejectedValue(new Error("History offline"));
  api.listSchedules.mockRejectedValue(new Error("Schedules offline"));
  render(<App api={api} runtime={runtime} />);
  const count = await screen.findByText("2 feeds unavailable");
  const details = count.closest("details");
  const summary = details?.querySelector("summary");
  if (!details || !summary) throw new Error("Failure disclosure not found");
  expect(details).not.toHaveAttribute("open");
  fireEvent.click(summary);
  const scheduleCalls = api.listSchedules.mock.calls.length;
  api.listExecutionPage.mockResolvedValue({
    executions: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    nextOffset: null,
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry executions" }));
  await waitFor(() =>
    expect(screen.queryByText("2 feeds unavailable")).toBeNull()
  );
  expect(api.listSchedules).toHaveBeenCalledTimes(scheduleCalls);
  expect(
    screen.getByRole("button", { name: "Retry schedules" })
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry executions" })).toBeNull();
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
  fireEvent.change(within(startDialog).getByRole("textbox"), {
    target: { value: "{" },
  });
  expect(
    within(startDialog).getByText("Invalid JSON — fix the syntax to continue.")
  ).toBeInTheDocument();
  fireEvent.change(within(startDialog).getByLabelText("Version"), {
    target: { value: "1" },
  });
  expect(
    within(startDialog).queryByText(
      "Invalid JSON — fix the syntax to continue."
    )
  ).toBeNull();
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
