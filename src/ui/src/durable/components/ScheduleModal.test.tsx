import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { schedule } from "../__tests__/fixtures";
import { ScheduleModal } from "./ScheduleModal";

test.each([undefined, 2])(
  "edits the persisted input and keeps workflow version %s fixed",
  async (version) => {
    const onSave = jest.fn();
    render(
      <ScheduleModal
        schedule={schedule({
          workflowVersion: version,
          input: { order: "existing" },
        })}
        busy={false}
        onSave={onSave}
        onPreview={jest.fn().mockResolvedValue([])}
        onClose={jest.fn()}
      />
    );
    const save = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(save).toBeEnabled());
    if (version) expect(screen.getByText("v2")).toBeVisible();
    expect(screen.queryByLabelText("Version")).toBeNull();
    await act(async () => {
      fireEvent.click(save);
    });
    expect(onSave).toHaveBeenCalledWith({
      interval: 60000,
      input: { order: "existing" },
    });
  }
);
