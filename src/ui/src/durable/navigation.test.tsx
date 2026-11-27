import { act, renderHook } from "@testing-library/react";
import { useStudioNavigation } from "./navigation";

afterEach(() => window.history.replaceState(null, "", "/"));
test("restores view, selection, filters, and modal from copied URLs and popstate without rewriting history", () => {
  window.history.replaceState(
    null,
    "",
    "/durable?runtimeId=orders&view=executions&select=run-1&workflow=orders&status=failed&query=exact&modal=signal"
  );
  const { result } = renderHook(useStudioNavigation);
  expect(result.current).toMatchObject({
    view: "executions",
    selectedId: "run-1",
    workflowFilter: "orders",
    statusFilter: "failed",
    query: "exact",
    modal: "signal",
  });
  act(() => result.current.navigate({ view: "overview", modal: null }));
  expect(new URLSearchParams(window.location.search).get("view")).toBe(
    "overview"
  );
  expect(new URLSearchParams(window.location.search).get("runtimeId")).toBe(
    "orders"
  );
  const entries = window.history.length;
  act(() => result.current.navigate({ query: "changed" }, true));
  expect(window.history.length).toBe(entries);
  const push = jest.spyOn(window.history, "pushState");
  act(() => {
    window.history.replaceState(
      null,
      "",
      "/durable?runtimeId=orders&view=schedules"
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current).toMatchObject({
    view: "schedules",
    selectedId: null,
    query: "",
    modal: null,
  });
  expect(push).not.toHaveBeenCalled();
  push.mockRestore();
});
