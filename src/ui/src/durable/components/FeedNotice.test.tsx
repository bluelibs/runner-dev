import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FeedNotices, type FeedNoticeState } from "./FeedNotice";

const now = Date.parse("2026-11-14T12:00:00Z");
function feed(label: string, error: string | null = null): FeedNoticeState {
  return {
    label,
    error,
    updatedAt: now - 60000,
    loading: false,
    onRetry: jest.fn(),
  };
}

test("renders nothing for healthy feeds and keeps a single failure directly actionable", () => {
  const schedules = feed("Schedules", "Schedule store offline");
  const { container, rerender } = render(
    <FeedNotices feeds={[feed("Executions")]} now={now} />
  );
  expect(container).toBeEmptyDOMElement();
  rerender(<FeedNotices feeds={[schedules, feed("Executions")]} now={now} />);
  expect(container.querySelector("details")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Showing data from 1m ago"
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry schedules" }));
  expect(schedules.onRetry).toHaveBeenCalledTimes(1);
});

test("collapses multiple failures while retaining each message, freshness and independent retry", () => {
  const schedules = feed("Schedules", "Schedule store offline");
  const executions = feed("Executions", "History offline");
  const stuck = {
    ...feed("Stuck executions", "Recovery offline"),
    updatedAt: null,
  };
  const { container, rerender } = render(
    <FeedNotices feeds={[schedules, executions, stuck]} now={now} />
  );
  const details = container.querySelector("details");
  expect(details).not.toHaveAttribute("open");
  const summary = details?.querySelector("summary");
  if (!details || !summary)
    throw new Error("Grouped failure disclosure is missing");
  expect(within(summary).getByRole("alert")).toHaveTextContent(
    "3 feeds unavailable"
  );
  fireEvent.click(summary);
  expect(details).toHaveAttribute("open");
  expect(screen.getByText(/History offline/)).toHaveTextContent(
    "Showing data from 1m ago"
  );
  expect(screen.getByText(/Recovery offline/)).toHaveTextContent(
    "No data loaded yet"
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry executions" }));
  expect(executions.onRetry).toHaveBeenCalledTimes(1);
  expect(schedules.onRetry).not.toHaveBeenCalled();
  rerender(
    <FeedNotices feeds={[schedules, feed("Executions"), stuck]} now={now} />
  );
  expect(screen.getByText("2 feeds unavailable")).toBeInTheDocument();
  expect(details).toHaveAttribute("open");
  rerender(
    <FeedNotices
      feeds={[schedules, feed("Executions"), feed("Stuck executions")]}
      now={now}
    />
  );
  expect(container.querySelector("details")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Retry schedules" })
  ).toBeInTheDocument();
});
