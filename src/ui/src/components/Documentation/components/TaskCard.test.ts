/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import type { Task } from "../../../../../schema/model";
import { TaskCard } from "./TaskCard";

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

jest.mock("./common/MermaidDiagram", () => ({
  MermaidDiagram: () => null,
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
});
