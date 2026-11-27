import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { StudioTimelineNode } from "../../../../durable/shared/types";
import { Timeline } from "./Timeline";

function node(
  id: string,
  overrides: Partial<StudioTimelineNode> = {}
): StudioTimelineNode {
  return {
    id,
    label: id,
    description: "Timeline item",
    kind: "step",
    state: "completed",
    branchTaken: null,
    result: null,
    completedAt: "2026-11-25T10:00:00.000Z",
    wait: null,
    ...overrides,
  };
}

test("formats Runner 6.10 internal step labels, nested child steps, version chips and Reset before", () => {
  const onResetBeforeStep = jest.fn();
  const onSignal = jest.fn();

  render(
    <Timeline
      now={Date.parse("2026-11-25T10:00:00.000Z")}
      onSignal={onSignal}
      canReset
      onResetBeforeStep={onResetBeforeStep}
      edges={[]}
      nodes={[
        node("__state:write:0", { kind: "state" }),
        node(
          '__command:["exec-1","app.tasks.update-shipping-address","req-1"]',
          { kind: "command", workflowVersion: 2 }
        ),
        node(
          '__command-step:"[\\"exec-1\\",\\"app.tasks.update-shipping-address\\",\\"req-1\\"]":__state:write:0',
          { kind: "state" }
        ),
        node("ship-1", {
          kind: "child",
          parentStepId: "parallel-step",
          taskKey: "shipment",
          workflowVersion: 3,
        }),
        node("__signal:review-approval", {
          kind: "signal",
          state: "waiting",
          wait: { signalId: "review-approval" },
        }),
        node("__sleep:wait-1", { kind: "sleep" }),
        node("__continue", { kind: "continue", resettable: true }),
      ]}
    />
  );

  expect(screen.getByText("State update #1")).toBeInTheDocument();
  expect(
    screen.getByText("Command · update-shipping-address")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Command step · State update #1")
  ).toBeInTheDocument();
  expect(screen.getByText("inside parallel-step")).toBeInTheDocument();
  expect(screen.getByText("v3")).toBeInTheDocument();
  expect(screen.getByText("Signal · review-approval")).toBeInTheDocument();
  expect(screen.getByText("Sleep · wait-1")).toBeInTheDocument();
  expect(screen.getAllByText("Continue as new")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Send review-approval" }));
  expect(onSignal).toHaveBeenCalledWith("review-approval");

  fireEvent.click(screen.getByRole("button", { name: "Reset before" }));
  expect(onResetBeforeStep).toHaveBeenCalledWith("__continue");
});
