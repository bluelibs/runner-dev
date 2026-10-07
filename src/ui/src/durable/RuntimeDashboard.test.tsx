import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DurableRuntimeDescriptor } from "../../../durable/shared/runtime";
import { RuntimeDashboard } from "./RuntimeDashboard";

jest.mock("./App", () => ({
  App: ({ runtime }: { runtime: DurableRuntimeDescriptor }) => (
    <div data-testid="studio">{runtime.id}</div>
  ),
}));
const capabilities = {
  pause: false,
  resume: false,
  restart: false,
  state: false,
};
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  window.history.replaceState(null, "", "/");
});

test("shows an honest empty state when no durable runtime is registered", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ runtimes: [] }) });
  render(<RuntimeDashboard />);
  expect(await screen.findByText("Ready when your workflows are")).toBeTruthy();
  expect(screen.queryByTestId("studio")).toBeNull();
});

test("uses the requested runtime and resets execution selection when switching", async () => {
  window.history.replaceState(
    null,
    "",
    "/durable?runtimeId=finance&select=old-run"
  );
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      runtimes: [
        { id: "orders", title: "Orders", capabilities },
        { id: "finance", title: "Finance", capabilities },
      ],
    }),
  });
  render(<RuntimeDashboard />);
  await waitFor(() =>
    expect(screen.getByTestId("studio").textContent).toBe("finance")
  );
  fireEvent.change(screen.getByLabelText("Runtime"), {
    target: { value: "orders" },
  });
  expect(screen.getByTestId("studio").textContent).toBe("orders");
  expect(window.location.search).toBe("?runtimeId=orders");
});

test("reports discovery errors and retries without inventing a connected runtime", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        runtimes: [{ id: "orders", title: "Orders", capabilities }],
      }),
    });
  render(<RuntimeDashboard />);
  expect(await screen.findByText("Runtime unavailable")).toBeTruthy();
  fireEvent.click(screen.getByText("Retry connection"));
  expect(await screen.findByTestId("studio")).toBeTruthy();
});
