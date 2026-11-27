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
import { schedule, timestamp, workflow } from "../__tests__/fixtures";

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
    workflows: [workflow],
    busy: false,
    now: Date.parse(timestamp),
    onCreate: jest.fn().mockResolvedValue(undefined),
    onUpdate: jest.fn().mockResolvedValue(undefined),
    onPreview: jest.fn().mockResolvedValue([timestamp]),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
  };
}
afterEach(() => jest.useRealTimers());

test.each(["create", "update"])(
  "retains the %s draft on rejection, prevents pending dismissal, and closes after retry succeeds",
  async (mode) => {
    const options = props();
    const save = mode === "create" ? options.onCreate : options.onUpdate;
    const pending = deferred<void>();
    save.mockReturnValueOnce(pending.promise);
    render(<Schedules {...options} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: mode === "create" ? "New schedule" : "Edit",
      })
    );
    const dialog = screen.getByRole("dialog");
    const editor = within(dialog).getByRole("textbox", { name: "JSON input" });
    fireEvent.change(editor, { target: { value: '{"draft":42}' } });
    const submit = within(dialog).getByRole("button", {
      name: mode === "create" ? "Create schedule" : "Save changes",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
    await act(async () => pending.reject(new Error("Input rejected")));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Input rejected"
    );
    expect(editor).toHaveValue('{"draft":42}');
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save).toHaveBeenCalledTimes(2);
  }
);

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

test("ignores out-of-order cadence previews, gates save on current validation, and accepts zero delay", async () => {
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
      workflows={[workflow]}
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
  const submit = screen.getByRole("button", { name: "Create schedule" });
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
  fireEvent.change(screen.getByLabelText("Cadence"), {
    target: { value: "delay" },
  });
  fireEvent.change(screen.getByLabelText("Milliseconds"), {
    target: { value: "0" },
  });
  await act(async () => jest.advanceTimersByTime(180));
  expect(preview).toHaveBeenLastCalledWith({ delay: 0 });
  expect(submit).toBeEnabled();
});

test("retries a failed preview with the same cadence and preserves the schedule draft", async () => {
  const options = props();
  options.onPreview.mockRejectedValueOnce(new Error("Preview offline"));
  render(<Schedules {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
  const dialog = within(screen.getByRole("dialog"));
  const save = dialog.getByRole("button", { name: "Create schedule" });
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
