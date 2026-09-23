/** @jest-environment jsdom */

import React from "react";
import { render } from "@testing-library/react";
import type { Event, Hook, Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { TopologyPanel } from "./TopologyPanel";

const mockBaseModal = jest.fn((_props: { subtitle?: string }) => null);

jest.mock("./modals", () => ({
  BaseModal: (props: { subtitle?: string }) => mockBaseModal(props),
}));
jest.mock("./TopologyPanelView", () => ({ TopologyPanelView: () => null }));

const buildTask: Task = {
  id: "task.build",
  emits: ["event.shipped"],
  dependsOn: [],
  middleware: [],
  tags: [],
};
const shippedEvent: Event = {
  id: "event.shipped",
  listenedToBy: ["hook.shipped"],
  transactional: false,
  parallel: false,
  tags: [],
};
const shippedHook: Hook = {
  id: "hook.shipped",
  events: ["event.shipped"],
  dependsOn: [],
  emits: [],
  tags: [],
};

describe("TopologyPanel", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.location.hash = "";
  });

  it("reports filtered-out impact in the fullscreen blast subtitle", () => {
    window.location.hash = "#topology/task/task.build";
    const introspector = new Introspector({
      data: {
        tasks: [buildTask],
        hooks: [shippedHook],
        resources: [],
        events: [shippedEvent],
        middlewares: [],
        tags: [],
        rootId: null,
      },
    });

    // Sidebar filters hide the event; it is still downstream of the task.
    render(
      React.createElement(TopologyPanel, {
        introspector,
        tasks: [buildTask],
        resources: [],
        events: [],
        hooks: [shippedHook],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
      })
    );

    expect(mockBaseModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        subtitle:
          "Blast radius · 2 affected (1 hidden by filters) within 2 hops",
      })
    );
  });
});
