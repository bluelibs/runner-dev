import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Introspector } from "../../../../../resources/models/Introspector";
import type { Resource } from "../../../../../schema/model";
import { TopologyPanel } from "./TopologyPanel";
import { parseTopologyHash } from "../utils/topologyGraph.state";
import { copyToClipboard } from "./chat/ChatUtils";

jest.mock("./chat/ChatUtils", () => ({
  copyToClipboard: jest.fn().mockResolvedValue(true),
}));

function resource(id: string, registers: string[]): Resource {
  return {
    id,
    registers,
    emits: [],
    dependsOn: [],
    middleware: [],
    overrides: [],
    tags: [],
  };
}
function navigate(hash: string) {
  act(() => {
    window.history.pushState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
function app(extraListeners = 0) {
  const props = {
    resources: [
      resource("root", ["billing", "webhooks"]),
      resource("billing", ["stripe.event", "billing.applyWebhook"]),
      resource("webhooks", ["delivery"]),
      resource("delivery", []),
    ],
    events: [
      {
        id: "stripe.event",
        listenedToBy: ["billing.applyWebhook"],
        tags: [],
        transactional: false,
        parallel: false,
      },
    ],
    hooks: [
      {
        id: "billing.applyWebhook",
        events: ["stripe.event"],
        dependsOn: ["delivery"],
        emits: [],
        tags: [],
      },
    ],
    tasks: [],
    tags: [],
    errors: [],
    asyncContexts: [],
    middlewares: [],
  };
  for (let index = 0; index < extraListeners; index++) {
    const id = `billing.listener${index}`;
    props.resources[1].registers.push(id);
    props.events[0].listenedToBy.push(id);
    props.hooks.push({
      id,
      events: ["stripe.event"],
      dependsOn: [],
      emits: [],
      tags: [],
    });
  }
  const introspector = new Introspector({ data: { ...props, rootId: "root" } });
  return render(<TopologyPanel {...props} introspector={introspector} />);
}

test("browses one ownership branch, jumps across branches and restores a shared impact path", async () => {
  navigate("#topology");
  app();
  const branch = screen.getByRole("link", { name: "billing" });
  navigate(branch.getAttribute("href")!);
  expect(screen.getByRole("link", { name: "applyWebhook" })).toBeTruthy();
  const jump = screen.getByRole("searchbox", { name: "Jump to element" });
  fireEvent.change(jump, { target: { value: "delivery" } });
  expect(
    screen.getByText(/resource · 0 registered · root › webhooks/)
  ).toBeTruthy();
  const target = screen.getByRole("link", { name: "delivery" });
  expect(parseTopologyHash(target.getAttribute("href"))?.focus?.id).toBe(
    "delivery"
  );
  fireEvent.change(jump, { target: { value: "stripe.event" } });
  navigate(screen.getByRole("link", { name: "event" }).getAttribute("href")!);
  expect(screen.getByRole("heading", { name: "Handled by 1" })).toBeTruthy();
  navigate(
    screen.getByRole("link", { name: "Impact paths" }).getAttribute("href")!
  );
  const why = screen.getByRole("link", { name: "View path to applyWebhook" });
  navigate(why.getAttribute("href")!);
  const path = within(screen.getByRole("region", { name: "Impact path" }));
  expect(path.getByRole("link", { name: "event" })).toBeTruthy();
  expect(path.getByText("is handled by")).toBeTruthy();
  expect(path.getByRole("link", { name: "applyWebhook" })).toBeTruthy();
  await act(async () => {
    fireEvent.click(path.getByRole("button", { name: "Copy link" }));
  });
  expect(copyToClipboard).toHaveBeenCalledWith(window.location.href);
  expect(parseTopologyHash(window.location.hash)).toMatchObject({
    radius: 1,
    why: "billing.applyWebhook",
    view: "blast",
  });
  navigate("#topology/hook/billing.applyWebhook?radius=1");
  expect(screen.getByRole("heading", { name: "Depends on 1" })).toBeTruthy();
  navigate(
    screen
      .getByRole("link", { name: /delivery delivery/ })
      .getAttribute("href")!
  );
  expect(screen.getByRole("heading", { name: "Used by 1" })).toBeTruthy();
});

test("expands a high-fanout event by owning feature and reopens the shared listener", () => {
  navigate("#topology/event/stripe.event?radius=1&panel=paths");
  app(20);
  const group = screen.getAllByRole("button", { name: "billing (21)" })[0];
  expect(group.getAttribute("aria-expanded")).toBe("false");
  expect(
    screen.queryByRole("link", { name: "View path to listener19" })
  ).toBeNull();
  fireEvent.click(group);
  const why = screen.getByRole("link", { name: "View path to listener19" });
  navigate(why.getAttribute("href")!);
  expect(
    screen.getByRole("region", { name: "Impact path" }).textContent
  ).toContain("listener19");
});
