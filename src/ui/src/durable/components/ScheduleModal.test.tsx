import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StudioWorkflow } from "../../../../durable/shared/types";
import { schedule, workflow } from "../__tests__/fixtures";
import { studioApi } from "../__tests__/studioApi";
import { WorkflowApiContext } from "../workflowFeed";
import { ScheduleModal } from "./ScheduleModal";

const versionedWorkflow: StudioWorkflow = {
  ...workflow,
  version: 2,
  presets: [{ name: "v2 preset", payload: { orderId: "order-v2" } }],
  versions: [
    {
      version: 2,
      taskId: "app.ordersV2",
      title: "Order fulfillment",
      description: "v2",
      signals: [],
      commands: [],
      presets: [{ name: "v2 preset", payload: { orderId: "order-v2" } }],
    },
    {
      version: 1,
      taskId: "app.ordersV1",
      title: "Order fulfillment",
      description: "v1",
      signals: [],
      commands: [],
      presets: [{ name: "v1 preset", payload: { orderId: "order-v1" } }],
    },
  ],
};

test("selects workflow versions, updates presets, and submits version on new schedule", async () => {
  const api = studioApi();
  const onSave = jest.fn();
  const onPreview = jest.fn().mockResolvedValue(["2026-11-25T10:01:00.000Z"]);

  render(
    <WorkflowApiContext.Provider value={api}>
      <ScheduleModal
        workflows={[versionedWorkflow]}
        busy={false}
        onSave={onSave}
        onPreview={onPreview}
        onClose={jest.fn()}
      />
    </WorkflowApiContext.Provider>
  );

  await waitFor(() => expect(onPreview).toHaveBeenCalled());
  const versionSelect = screen.getByLabelText("Version");
  expect(versionSelect).toHaveValue("2");

  fireEvent.change(versionSelect, { target: { value: "1" } });
  const inputBox = screen
    .getAllByRole("textbox")
    .find((element) => element.tagName === "TEXTAREA");
  expect(inputBox).toBeDefined();
  expect((inputBox as HTMLTextAreaElement).value).toContain("order-v1");

  const submitButton = screen.getByRole("button", { name: "Create schedule" });
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  fireEvent.click(submitButton);

  expect(onSave).toHaveBeenCalledWith({
    workflow: "orders",
    version: 1,
    input: { orderId: "order-v1" },
    interval: 60000,
  });
});

test("hydrates version and preset when workflow details arrive asynchronously", async () => {
  const api = studioApi();
  api.getWorkflow.mockResolvedValue(versionedWorkflow);
  const onSave = jest.fn();
  const onPreview = jest.fn().mockResolvedValue(["2026-11-25T10:01:00.000Z"]);

  render(
    <WorkflowApiContext.Provider value={api}>
      <ScheduleModal
        workflows={[]}
        busy={false}
        onSave={onSave}
        onPreview={onPreview}
        onClose={jest.fn()}
      />
    </WorkflowApiContext.Provider>
  );

  await waitFor(() =>
    expect(screen.getByLabelText("Version")).toHaveValue("2")
  );
  const submitButton = screen.getByRole("button", { name: "Create schedule" });
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  fireEvent.click(submitButton);

  expect(onSave).toHaveBeenCalledWith({
    workflow: "orders",
    version: 2,
    input: { orderId: "order-v2" },
    interval: 60000,
  });
});

test("clears invalid JSON errors when switching versions and omits catalog version on unversioned schedules", async () => {
  const api = studioApi();
  const onPreview = jest.fn().mockResolvedValue(["2026-11-25T10:01:00.000Z"]);
  const { unmount } = render(
    <WorkflowApiContext.Provider value={api}>
      <ScheduleModal
        workflows={[versionedWorkflow]}
        busy={false}
        onSave={jest.fn()}
        onPreview={onPreview}
        onClose={jest.fn()}
      />
    </WorkflowApiContext.Provider>
  );

  const editor = screen
    .getAllByRole("textbox")
    .find((element) => element.tagName === "TEXTAREA") as HTMLTextAreaElement;
  fireEvent.change(editor, { target: { value: "{" } });
  expect(
    screen.getByText("Invalid JSON — fix the syntax to continue.")
  ).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Version"), {
    target: { value: "1" },
  });
  expect(
    screen.queryByText("Invalid JSON — fix the syntax to continue.")
  ).toBeNull();
  unmount();

  render(
    <WorkflowApiContext.Provider value={api}>
      <ScheduleModal
        schedule={schedule({ workflowVersion: undefined })}
        workflows={[versionedWorkflow]}
        busy={false}
        onSave={jest.fn()}
        onPreview={onPreview}
        onClose={jest.fn()}
      />
    </WorkflowApiContext.Provider>
  );

  await waitFor(() => expect(onPreview).toHaveBeenCalled());
  expect(screen.queryByText(/^v2$/)).toBeNull();
});
