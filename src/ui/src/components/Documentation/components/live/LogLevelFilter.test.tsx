/** @jest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LevelFilter, LogLevelFilter } from "./LogLevelFilter";

function Filter() {
  const [value, select] = useState<LevelFilter>("");
  return <LogLevelFilter value={value} onChange={select} />;
}

it("opens on the current level, navigates by keyboard and restores focus after selection or dismissal", () => {
  render(<Filter />);
  const trigger = screen.getByRole("button", {
    name: "Filter log level, All levels",
  });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const all = screen.getByRole("menuitemradio", { name: "All levels" });
  expect(document.activeElement).toBe(all);
  fireEvent.keyDown(all, { key: "ArrowDown" });
  const errors = screen.getByRole("menuitemradio", {
    name: "Errors · grouped",
  });
  expect(document.activeElement).toBe(errors);
  fireEvent.click(errors);
  expect(document.activeElement).toBe(trigger);
  expect(trigger.textContent).toBe("Errors · grouped");
  fireEvent.click(trigger);
  const selected = screen.getByRole("menuitemradio", { checked: true });
  expect(document.activeElement).toBe(selected);
  fireEvent.keyDown(selected, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.mouseDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
});
