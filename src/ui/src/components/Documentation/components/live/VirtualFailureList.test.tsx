/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VirtualFailureList } from "./VirtualFailureList";
it("mounts a bounded viewport and fetches more only near the end", () => {
  const failures = Array.from({ length: 1000 }, (_, i) => ({
    sequence: i + 1,
    timestampMs: 100,
    message: `Failure ${i}`,
  }));
  const load = jest.fn();
  const { container } = render(
    <VirtualFailureList
      failures={failures}
      hasMore
      loading={false}
      error={false}
      onLoadMore={load}
      onTrace={() => {}}
      loadingTrace={null}
    />
  );
  expect(container.querySelectorAll("article").length).toBeLessThan(15);
  expect(screen.getByText("Failure 0")).toBeTruthy();
  expect(load).not.toHaveBeenCalled();
  const root = screen.getByRole("feed");
  fireEvent.scroll(root, { target: { scrollTop: 219500 } });
  expect(container.querySelectorAll("article").length).toBeLessThan(15);
  expect(screen.getByText("Failure 999")).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(1);
});
it("does not auto-retry errors or overlap a pending request", () => {
  const load = jest.fn();
  const props = {
    failures: [],
    hasMore: true,
    loading: false,
    error: true,
    onLoadMore: load,
    onTrace: () => {},
    loadingTrace: null,
  };
  const { rerender } = render(<VirtualFailureList {...props} />);
  expect(load).not.toHaveBeenCalled();
  rerender(<VirtualFailureList {...props} error={false} loading />);
  expect(load).not.toHaveBeenCalled();
  rerender(<VirtualFailureList {...props} error={false} />);
  expect(load).toHaveBeenCalledTimes(1);
});
