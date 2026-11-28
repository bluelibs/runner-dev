/** @jest-environment jsdom */

import React from "react";
import { render, screen, within } from "@testing-library/react";
import type { Event, Hook, Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { TopologyPanel } from "./TopologyPanel";

jest.mock("./chat/ChatUtils", () => ({ copyToClipboard: jest.fn() }));

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

  it("restores a shared two-step path through a filtered event", () => {
    window.location.hash =
      "#topology/task/task.build?radius=2&why=hook.shipped";
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

    const path = within(screen.getByRole("region", { name: "Impact path" }));
    expect(path.getAllByRole("listitem")).toHaveLength(3);
    expect(path.getByText("emits")).toBeTruthy();
    expect(path.getByText("is handled by")).toBeTruthy();
    expect(screen.getByText("1 hidden by filters")).toBeTruthy();
  });
});
