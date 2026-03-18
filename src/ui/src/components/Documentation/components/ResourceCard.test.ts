/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { Resource } from "../../../../../schema/model";
import { ResourceCard } from "./ResourceCard";

jest.mock("./ResourceCard.scss", () => ({}), { virtual: true });
jest.mock("./common/DependenciesSection.scss", () => ({}), { virtual: true });
jest.mock("./common/RegisteredByInfoBlock.scss", () => ({}), {
  virtual: true,
});

jest.mock("./CodeModal", () => ({
  CodeModal: () => null,
}));

jest.mock("./TagsSection", () => ({
  TagsSection: () => null,
}));

jest.mock("./SchemaRenderer", () => ({
  SchemaRenderer: () => null,
}));

jest.mock("./common/DependenciesSection", () => ({
  DependenciesSection: () => null,
}));

jest.mock("./ResourceIsolationSection", () => ({
  ResourceIsolationSection: () => null,
}));

jest.mock("./ResourceSubtreeSection", () => ({
  ResourceSubtreeSection: () => null,
}));

jest.mock("./ResourceEventLanesSection", () => ({
  ResourceEventLanesSection: () => null,
}));

jest.mock("./ResourceRpcLanesSection", () => ({
  ResourceRpcLanesSection: () => null,
}));

jest.mock("./common/SearchableList", () => ({
  SearchableList: () => null,
}));

jest.mock("./modals", () => ({
  BaseModal: () => null,
}));

jest.mock("./TopologyActionButton", () => ({
  TopologyActionButton: () => null,
}));

jest.mock("./common/ElementCard", () => ({
  ElementCard: ({
    children,
    title,
    meta,
    className,
    headerClassName,
  }: {
    children: React.ReactNode;
    title: React.ReactNode;
    meta?: React.ReactNode;
    className?: string;
    headerClassName?: string;
  }) =>
    React.createElement(
      "section",
      { "data-testid": "element-card", className },
      React.createElement(
        "div",
        { "data-testid": "element-card-header", className: headerClassName },
        React.createElement("h3", null, title),
        meta
      ),
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

describe("ResourceCard", () => {
  it("adds root resource treatment and fallback ownership copy", () => {
    const resource: Resource = {
      id: "app",
      meta: { title: "Application Shell" },
      emits: [],
      dependsOn: [],
      config: null,
      configSchema: null,
      middleware: [],
      overrides: [],
      registers: [],
      registeredBy: null,
      filePath: null,
    };

    const introspector = {
      getMiddlewareUsagesForResource: () => [],
      getTasksUsingResource: () => [],
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getTasksByIds: () => [],
      getResourcesByIds: () => [],
      getMiddlewaresByIds: () => [],
      getEventsByIds: () => [],
      getHooksByIds: () => [],
      getResources: () => [resource],
      getRoot: () => resource,
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(ResourceCard, {
        resource,
        introspector,
      })
    );

    expect(screen.getByText("Application Root")).toBeTruthy();
    expect(screen.getByText("Root Resource")).toBeTruthy();
    expect(screen.getByText("Application root")).toBeTruthy();
    expect(screen.getByTestId("element-card").className).toContain(
      "resource-card--root"
    );
    expect(screen.getByTestId("element-card-header").className).toContain(
      "resource-card__header--root"
    );
  });
});
