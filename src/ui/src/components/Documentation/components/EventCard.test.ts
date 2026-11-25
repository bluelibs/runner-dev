/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { Event } from "../../../../../schema/model";
import { EventCard } from "./EventCard";
import { DocumentationModeProvider } from "../context/DocumentationModeContext";

jest.mock("./EventCard.scss", () => ({}), { virtual: true });
jest.mock("./SchemaRenderer", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("./CodeModal", () => ({
  CodeModal: () => null,
}));
jest.mock("./ExecuteModal", () => () => null);
jest.mock("./TagsSection", () => ({
  TagsSection: () => null,
}));
jest.mock("./TopologyActionButton", () => ({
  TopologyActionButton: () => null,
}));
jest.mock("./common/RegisteredByInfoBlock", () => ({
  RegisteredByInfoBlock: () => null,
}));
jest.mock("./common/OverviewIdLink", () => ({
  OverviewIdLink: () => null,
}));
jest.mock("./common/ElementCard", () => ({
  ElementCard: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) =>
    React.createElement(
      "section",
      null,
      React.createElement("h3", null, title),
      children
    ),
  CardSection: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("h4", null, title),
      children
    ),
  InfoBlock: ({
    label,
    children,
  }: {
    label: React.ReactNode;
    children: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      null,
      React.createElement("strong", null, label),
      children
    ),
}));

describe("EventCard durable bridge rendering", () => {
  it("renders the DURABLE badge and bridge configuration details", () => {
    const event = {
      id: "app.events.orderPaid",
      meta: { title: "Order Paid" },
      filePath: null,
      transactional: false,
      parallel: false,
      tags: ["runner.tags.durableEvent"],
      tagsDetailed: [
        {
          id: "runner.tags.durableEvent",
          config: JSON.stringify({
            key: "orders.paid",
            compensation: "required",
          }),
        },
      ],
      listenedToBy: [],
      emittedBy: [],
      registeredBy: null,
    } as unknown as Event;

    const introspector = {
      getEmittersOfEvent: () => [],
      getHooksOfEvent: () => [],
      getRpcLaneResourceForEvent: () => null,
      getTagsByIds: () => [],
      getResources: () => [],
    } as any;

    render(
      React.createElement(
        DocumentationModeProvider,
        { mode: "live" },
        React.createElement(EventCard, {
          event,
          introspector,
        })
      )
    );

    expect(screen.getByText("DURABLE")).toBeInTheDocument();
    expect(screen.getByText("Durable Event:")).toBeInTheDocument();
    expect(screen.getByText("orders.paid")).toBeInTheDocument();
    expect(screen.getByText("compensation: required")).toBeInTheDocument();
  });
});
