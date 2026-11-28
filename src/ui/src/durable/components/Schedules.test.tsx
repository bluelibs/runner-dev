import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { Schedules } from "./Schedules";
import { ScheduleModal } from "./ScheduleModal";
import { schedule, timestamp } from "../__tests__/fixtures";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function props() {
  return {
    schedules: [schedule()],
    busy: false,
    now: Date.parse(timestamp),
    onViewRuns: jest.fn(),
    onUpdate: jest.fn().mockResolvedValue(undefined),
    onPreview: jest.fn().mockResolvedValue([timestamp]),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
  };
}
afterEach(() => jest.useRealTimers());

test("retains the existing schedule draft on rejection, prevents pending dismissal, and closes after retry succeeds", async () => {
  const options = props();
  const save = options.onUpdate;
  const pending = deferred<void>();
  save.mockReturnValueOnce(pending.promise);
  render(<Schedules {...options} />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Edit",
    })
  );
  const dialog = screen.getByRole("dialog");
  const editor = within(dialog).getByRole("textbox", { name: "JSON input" });
  fireEvent.change(editor, { target: { value: '{"draft":42}' } });
  const submit = within(dialog).getByRole("button", {
    name: "Save changes",
  });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(save).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(dialog).toBeInTheDocument();
  await act(async () => pending.reject(new Error("Input rejected")));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Input rejected");
  expect(editor).toHaveValue('{"draft":42}');
  fireEvent.click(submit);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(save).toHaveBeenCalledTimes(2);
});

test("requires explicit deletion confirmation and preserves active filters as the list shrinks", () => {
  const options = props();
  options.schedules = Array.from({ length: 6 }, (_, index) =>
    schedule({ id: `schedule-${index}` })
  );
  const { rerender } = render(<Schedules {...options} />);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "schedule-5" },
  });
  rerender(
    <Schedules {...options} schedules={options.schedules.slice(0, 5)} />
  );
  expect(screen.getByRole("searchbox")).toHaveValue("schedule-5");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  expect(options.onRemove).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Back" })
  );
  expect(options.onRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete schedule",
    })
  );
  expect(options.onRemove).toHaveBeenCalledWith("schedule-0");
});

test("ignores out-of-order cadence previews, gates save on current validation, and rejects nonpositive intervals", async () => {
  jest.useFakeTimers();
  const older = deferred<string[]>();
  const newer = deferred<string[]>();
  const preview = jest
    .fn()
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise)
    .mockResolvedValue([timestamp]);
  render(
    <ScheduleModal
      schedule={schedule()}
      busy={false}
      onSave={jest.fn()}
      onPreview={preview}
      onClose={jest.fn()}
    />
  );
  await act(async () => jest.advanceTimersByTime(180));
  fireEvent.change(screen.getByLabelText("Milliseconds"), {
    target: { value: "120000" },
  });
  const submit = screen.getByRole("button", { name: "Save changes" });
  expect(submit).toBeDisabled();
  await act(async () => jest.advanceTimersByTime(180));
  await act(async () => newer.resolve([timestamp]));
  expect(submit).toBeEnabled();
  await act(async () => older.reject(new Error("Old cadence error")));
  expect(screen.queryByText("Old cadence error")).toBeNull();
  expect(submit).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Milliseconds"), {
    target: { value: "1.5" },
  });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Milliseconds"), {
    target: { value: "0" },
  });
  expect(submit).toBeDisabled();
});

test("retries a failed preview with the same cadence and preserves the schedule draft", async () => {
  const options = props();
  options.onPreview.mockRejectedValueOnce(new Error("Preview offline"));
  render(<Schedules {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = within(screen.getByRole("dialog"));
  const save = dialog.getByRole("button", { name: "Save changes" });
  const editor = dialog.getByRole("textbox", { name: "JSON input" });
  fireEvent.change(editor, { target: { value: '{"keep":true}' } });
  const retry = await dialog.findByRole("button", { name: "Retry preview" });
  expect(save).toBeDisabled();
  fireEvent.click(retry);
  expect(save).toBeDisabled();
  await waitFor(() => expect(save).toBeEnabled());
  expect(options.onPreview.mock.calls[1]).toEqual(
    options.onPreview.mock.calls[0]
  );
  expect(editor).toHaveValue('{"keep":true}');
});

test("reserves space for the first schedule request and keeps a known empty result during refresh", () => {
  const options = { ...props(), schedules: [], loading: true };
  const view = render(<Schedules {...options} available={false} />);
  expect(
    screen.getByRole("status", { name: "Loading schedules" })
  ).toBeVisible();
  expect(screen.queryByText("No schedules in this runtime")).toBeNull();
  view.rerender(<Schedules {...options} available />);
  expect(screen.getByText("No schedules in this runtime")).toBeVisible();
  expect(screen.queryByRole("button", { name: "New schedule" })).toBeNull();
  expect(
    screen.queryByRole("status", { name: "Loading schedules" })
  ).toBeNull();
});
