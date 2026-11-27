/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModalStackProvider } from "../modals";
import { ErrorTracker } from "./ErrorTracker";
import { graphqlRequest } from "../../utils/graphqlClient";
import { copyToClipboard } from "../chat/ChatUtils";
import { downloadTelemetry } from "./telemetryExport";

jest.mock("../../utils/graphqlClient", () => ({ graphqlRequest: jest.fn() }));
jest.mock("../chat/ChatUtils", () => ({ copyToClipboard: jest.fn() }));
jest.mock("./telemetryExport", () => ({
  ...jest.requireActual("./telemetryExport"),
  downloadTelemetry: jest.fn(),
}));
const latest = {
  sourceKind: "TASK",
  sourceId: "checkout",
  message: "Provider timed out",
};
const group = {
  id: "group",
  latest,
  count: 2,
  firstSeenMs: 100,
  lastSeenMs: 200,
};
const occurrences = [2, 1].map((sequence) => ({
  ...latest,
  sequence,
  timestampMs: sequence * 100,
  correlationId: "trace-" + sequence,
  stack: "stack " + sequence,
}));
const request = jest.mocked(graphqlRequest);
beforeEach(() => {
  jest.resetAllMocks();
  window.scrollTo = jest.fn();
});

it("opens grouped occurrences and uses only the selected trace for the prompt and JSON", async () => {
  request.mockImplementation(async (query, vars) => {
    if (query.includes("ErrorTracker"))
      return { live: { historyPersisted: true, errorGroups: [group] } };
    if (query.includes("ErrorGroupDetail"))
      return { live: { errorGroups: [{ ...group, occurrences }] } };
    const id = (vars?.ids as string[])[0];
    return {
      live: {
        logs: [
          {
            timestampMs: 100,
            sequence: 3,
            message: "log for " + id,
            level: "info",
          },
        ],
        errors: [],
        runs: [],
        emissions: [],
      },
    };
  });
  render(<ErrorTracker active={false} refreshKey={0} pollInterval={2000} />, {
    wrapper: ModalStackProvider,
  });
  fireEvent.click(
    await screen.findByRole("button", { name: /Provider timed out/ })
  );
  await screen.findByText("log for trace-2");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
  await screen.findByText("log for trace-1");
  fireEvent.click(screen.getByRole("button", { name: "Copy agent prompt" }));
  expect(copyToClipboard).toHaveBeenCalledWith(
    expect.stringContaining("log for trace-1")
  );
  expect(
    await screen.findByRole("textbox", { name: "Agent prompt" })
  ).toHaveProperty("value", expect.stringContaining("stack 1"));
  fireEvent.click(screen.getByRole("button", { name: "Export issue JSON" }));
  await waitFor(() =>
    expect(downloadTelemetry).toHaveBeenCalledWith(
      "error-group",
      expect.objectContaining({
        selectedOccurrence: occurrences[1],
        group: expect.objectContaining({ occurrences }),
      })
    )
  );
});

it("distinguishes an unavailable feed from an empty history", async () => {
  request.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({
    live: { historyPersisted: false, errorGroups: [] },
  });
  const view = render(
    <ErrorTracker active={false} refreshKey={0} pollInterval={2000} />
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Offline"
  );
  expect(screen.queryByText("No errors in retained history.")).toBeNull();
  view.rerender(
    <ErrorTracker active={false} refreshKey={1} pollInterval={2000} />
  );
  await screen.findByText("No errors in retained history.");
});

it("keeps focus and removes earlier results when a different search fails", async () => {
  request
    .mockResolvedValueOnce({
      live: { errorGroups: [group], historyError: "queue full" },
    })
    .mockRejectedValueOnce(new Error("Search offline"));
  render(<ErrorTracker active={false} refreshKey={0} pollInterval={2000} />);
  await screen.findByText("Provider timed out");
  expect(screen.getByRole("alert").textContent).toContain("queue full");
  const search = screen.getByRole("searchbox");
  search.focus();
  fireEvent.change(search, { target: { value: "different" } });
  expect(document.activeElement).toBe(search);
  expect(screen.queryByText("Provider timed out")).toBeNull();
  await screen.findByText("Search offline");
  expect(screen.queryByText("Provider timed out")).toBeNull();
});
