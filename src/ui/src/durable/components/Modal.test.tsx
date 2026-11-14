import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Modal } from "./Modal";

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open ? (
        <Modal title="Keyboard dialog" onClose={() => setOpen(false)}>
          <input aria-label="Draft" />
          <button>Last action</button>
        </Modal>
      ) : null}
    </>
  );
}
test("moves focus into the dialog, contains Tab, blocks background focus, and restores the trigger", () => {
  const { container } = render(<Example />);
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus();
  fireEvent.click(trigger);
  const close = screen.getByRole("button", { name: "Close" });
  const last = screen.getByRole("button", { name: "Last action" });
  expect(close).toHaveFocus();
  expect(container).toHaveAttribute("inert");
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(close).toHaveFocus();
  trigger.focus();
  expect(close).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(trigger).toHaveFocus();
  expect(container).not.toHaveAttribute("inert");
});

test("brings focus back when a pending submit button is disabled and handles Tab from the document body", () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <Modal title="Pending" onClose={onClose}>
      <button>Submit</button>
    </Modal>
  );
  screen.getByRole("button", { name: "Submit" }).focus();
  rerender(
    <Modal title="Pending" onClose={onClose} busy>
      <button disabled>Submit</button>
    </Modal>
  );
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(screen.getByRole("dialog")).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  rerender(
    <Modal title="Pending" onClose={onClose}>
      <button>Submit</button>
    </Modal>
  );
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
});
