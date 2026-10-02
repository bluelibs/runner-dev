/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApmFailuresModal } from "./ApmFailuresModal";
import { loadFailureDetails, loadRetainedTrace } from "./apmFailureDetails";

jest.mock("./apmFailureDetails", () => ({
  ...jest.requireActual("./apmFailureDetails"),
  loadFailureDetails: jest.fn(),
  loadRetainedTrace: jest.fn(),
}));
jest.mock("../modals", () => ({
  BaseModal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock("./TraceView", () => ({
  TraceView: ({ correlationId }: { correlationId: string }) => (
    <div>Trace for {correlationId}</div>
  ),
}));
const failures = jest.mocked(loadFailureDetails);
const trace = jest.mocked(loadRetainedTrace);
const selection = {
  nodeId: "app.on-order",
  nodeKind: "HOOK" as const,
  scope: "all" as const,
  windowMinutes: 30,
  endTimestampMs: 100_000,
};
beforeEach(() => {
  failures.mockReset();
  trace.mockReset();
});

it("opens the correlated trace and shows retained error stack details", async () => {
  failures.mockResolvedValue({
    hasMore: false,
    failures: [
      {
        sequence: 1,
        timestampMs: 90_000,
        message: "Reaction failed",
        stack: "Error: Reaction failed",
        correlationId: "order-1",
      },
    ],
  });
  trace.mockResolvedValue({ logs: [], emissions: [], errors: [], runs: [] });
  render(<ApmFailuresModal selection={selection} onClose={() => undefined} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "View trace & logs" })
  );
  expect(await screen.findByText("Trace for order-1")).toBeTruthy();
  expect(trace).toHaveBeenCalledWith("order-1");
  expect(screen.getByText("Error stack")).toBeTruthy();
});

it("explains missing correlation and expired detailed history", async () => {
  failures.mockResolvedValue({
    hasMore: false,
    failures: [{ sequence: 1, timestampMs: 90_000, message: "Failed" }],
  });
  const { unmount } = render(
    <ApmFailuresModal selection={selection} onClose={() => undefined} />
  );
  expect(await screen.findByText("No correlation ID retained")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "View trace & logs" })
  ).toBeNull();
  unmount();
  failures.mockResolvedValue({ hasMore: false, failures: [] });
  render(<ApmFailuresModal selection={selection} onClose={() => undefined} />);
  expect(
    await screen.findByText(/No matching failure details were found/)
  ).toBeTruthy();
});

it("loads older errors on demand and preserves the list if loading fails", async () => {
  const first = { sequence: 2, timestampMs: 90_000, message: "First error" };
  const older = { sequence: 1, timestampMs: 89_000, message: "Older error" };
  failures.mockResolvedValueOnce({
    failures: [first],
    hasMore: true,
    cursor: { runs: 2, errors: null },
  });
  failures.mockRejectedValueOnce(new Error("Connection unavailable"));
  failures.mockResolvedValueOnce({ failures: [first, older], hasMore: false });
  render(<ApmFailuresModal selection={selection} onClose={() => undefined} />);

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Connection unavailable"
  );
  expect(screen.getByText("First error")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry loading older errors" })
  );
  expect(await screen.findByText("Older error")).toBeTruthy();
  expect(failures).toHaveBeenLastCalledWith(selection, {
    runs: 2,
    errors: null,
  });
  expect(
    screen.queryByRole("button", { name: "Retry loading older errors" })
  ).toBeNull();
});
