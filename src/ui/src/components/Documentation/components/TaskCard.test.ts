/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { Task } from "../../../../../schema/model";
import { TaskCard } from "./TaskCard";
import { DocumentationModeProvider } from "../context/DocumentationModeContext";

jest.mock("./TaskCard.scss", () => ({}), { virtual: true });
jest.mock("./common/DependenciesSection.scss", () => ({}), { virtual: true });

jest.mock("./CodeModal", () => ({
  CodeModal: () => null,
}));

jest.mock("./ExecuteModal", () => () => null);

jest.mock("./TagsSection", () => ({
  TagsSection: () => null,
}));

jest.mock("./SchemaRenderer", () => ({
  SchemaRenderer: () => null,
}));

jest.mock("./common/DependenciesSection", () => ({
  DependenciesSection: () => null,
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

describe("TaskCard middleware rendering", () => {
  it("shows the subtree policy badge only for subtree-origin middleware", () => {
    const task: Task = {
      id: "app.tasks.search",
      meta: { title: "Search Task" },
      emits: [],
      dependsOn: [],
      middleware: ["app.middleware.task.audit", "app.middleware.task.cache"],
      middlewareDetailed: [
        {
          id: "app.middleware.task.audit",
          config: null,
          origin: "subtree",
          subtreeOwnerId: "app.features.catalog",
        },
        {
          id: "app.middleware.task.cache",
          config: JSON.stringify({
            identityScope: { tenant: true, user: true },
          }),
          origin: "local",
          subtreeOwnerId: null,
        },
      ],
      filePath: null,
    };

    const introspector = {
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getMiddlewareUsagesForTask: () => [
        {
          id: "app.middleware.task.audit",
          config: null,
          origin: "subtree",
          subtreeOwnerId: "app.features.catalog",
          node: {
            id: "app.middleware.task.audit",
            meta: { title: "Audit Middleware" },
          },
        },
        {
          id: "app.middleware.task.cache",
          config: JSON.stringify({
            identityScope: { tenant: true, user: true },
          }),
          origin: "local",
          subtreeOwnerId: null,
          node: {
            id: "app.middleware.task.cache",
            meta: { title: "Cache Middleware" },
          },
        },
      ],
      getEmittedEvents: () => [],
      getTagsByIds: () => [],
    } as any;

    render(
      React.createElement(TaskCard, {
        task,
        introspector,
      })
    );

    expect(screen.getAllByText("Subtree Policy")).toHaveLength(1);
    expect(screen.getByText(/Source:/)).toBeTruthy();
    expect(screen.getByText("app › features › catalog")).toBeTruthy();
    expect(screen.getByText(/identityScope/)).toBeTruthy();
  });

  it("hides catalog-only GraphQL affordances in catalog mode", () => {
    const task: Task = {
      id: "app.tasks.durable",
      meta: { title: "Durable Task" },
      emits: [],
      dependsOn: [],
      middleware: [],
      middlewareDetailed: [],
      filePath: "/tmp/durable.ts",
      isDurable: true as any,
      durableWorkflowKey: null,
      coverage: { percentage: 88 } as any,
    };

    const introspector = {
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getMiddlewareUsagesForTask: () => [],
      getEmittedEvents: () => [],
      getTagsByIds: () => [],
      getEvent: () => null,
    } as any;

    render(
      React.createElement(
        DocumentationModeProvider,
        { mode: "catalog" },
        React.createElement(TaskCard, {
          task,
          introspector,
          mode: "catalog",
        })
      )
    );

    expect(screen.queryByText("(View Coverage)")).toBeNull();
    expect(screen.queryByText("Preview Graph")).toBeNull();
    expect(screen.queryByTitle("View file contents")).toBeNull();
    expect(screen.getByText("Workflow Key:")).toBeTruthy();
    expect(screen.getByText("app.tasks.durable")).toBeTruthy();
  });

  it("shows the explicit workflow key when one is configured", () => {
    const task: Task = {
      id: "app.tasks.orderApproval",
      meta: { title: "Order Approval" },
      emits: [],
      dependsOn: [],
      middleware: [],
      middlewareDetailed: [],
      filePath: null,
      isDurable: true as any,
      durableWorkflowKey: "orders.approval.workflow",
    };

    const introspector = {
      getDependencies: () => ({
        tasks: [],
        hooks: [],
        resources: [],
        errors: [],
      }),
      getMiddlewareUsagesForTask: () => [],
      getEmittedEvents: () => [],
      getTagsByIds: () => [],
      getEvent: () => null,
    } as any;

    render(
      React.createElement(TaskCard, {
        task,
        introspector,
      })
    );

    expect(screen.getByText("Workflow Key:")).toBeTruthy();
    expect(screen.getByText("orders.approval.workflow")).toBeTruthy();
  });
});
