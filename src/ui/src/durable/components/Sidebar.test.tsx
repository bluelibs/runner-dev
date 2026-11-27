import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { workflow } from "../__tests__/fixtures";
const originalWidth = window.innerWidth;
const originalResizeObserver = global.ResizeObserver;
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: originalWidth,
  });
  global.ResizeObserver = originalResizeObserver;
});
test.each([600, 1200])(
  "workflow selection at %ipx leaves focus on a visible control",
  async (width) => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: width,
    });
    const onWorkflowFilter = jest.fn();
    render(
      <Sidebar
        workflows={[
          { ...workflow, version: 1 },
          {
            ...workflow,
            key: "returns",
            title: "Returns",
            versions: [2, 1].map((version) => ({
              ...workflow,
              taskId: `returns-v${version}`,
              commands: [],
              version,
            })),
          },
        ]}
        view="executions"
        onView={jest.fn()}
        workflowFilter={null}
        onWorkflowFilter={onWorkflowFilter}
        counts={{ total: 0, live: 0, failed: 0 }}
        stuckCount={0}
        onRecover={jest.fn()}
        recovering={false}
      />
    );
    const toggle = screen.getByRole("button", { name: "Browse workflows" });
    fireEvent.click(toggle);
    expect(
      await screen.findByRole("button", {
        name: "Returns 2 versions · Commerce",
      })
    ).toBeInTheDocument();
    const select = await screen.findByRole("button", {
      name: "Order fulfillment v1 · Commerce",
    });
    select.focus();
    fireEvent.click(select);
    expect(onWorkflowFilter).toHaveBeenCalledWith(workflow.key);
    expect(width <= 920 ? toggle : select).toHaveFocus();
  }
);
