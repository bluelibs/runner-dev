/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ResourceSubtreeSection } from "./ResourceSubtreeSection";

jest.mock("./common/ElementCard", () => ({
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

describe("ResourceSubtreeSection", () => {
  it("renders subtree task identity and middleware identity scope summaries", () => {
    render(
      React.createElement(ResourceSubtreeSection, {
        subtree: {
          tasks: {
            middleware: ["app.middleware.task.audit"],
            validatorCount: 2,
            identity: [{ tenant: true, user: true, roles: ["ADMIN", "OPS"] }],
          },
          middleware: {
            identityScope: {
              tenant: true,
              user: true,
              required: true,
            },
          },
          resources: null,
          hooks: null,
          taskMiddleware: null,
          resourceMiddleware: null,
          events: null,
          tags: null,
        },
      })
    );

    expect(
      screen.getByText(/identity=tenant, user, roles=ADMIN \| OPS/)
    ).toBeTruthy();
    expect(screen.getByText(/tenant, user, required/)).toBeTruthy();
  });

  it("omits tenant when identity metadata marks it as false", () => {
    render(
      React.createElement(ResourceSubtreeSection, {
        subtree: {
          tasks: {
            middleware: [],
            validatorCount: 0,
            identity: [{ tenant: false, user: true, roles: [] }],
          },
          middleware: {
            identityScope: {
              tenant: false,
              user: true,
              required: false,
            },
          },
          resources: null,
          hooks: null,
          taskMiddleware: null,
          resourceMiddleware: null,
          events: null,
          tags: null,
        },
      })
    );

    expect(screen.getByText(/identity=user/)).toBeTruthy();
    expect(screen.getByText(/^user, optional$/)).toBeTruthy();
  });

  it("falls back to none when an identity gate has no visible parts", () => {
    render(
      React.createElement(ResourceSubtreeSection, {
        subtree: {
          tasks: {
            middleware: [],
            validatorCount: 0,
            identity: [{ tenant: false, user: false, roles: [] }],
          },
          middleware: {
            identityScope: {
              tenant: false,
              user: false,
              required: false,
            },
          },
          resources: null,
          hooks: null,
          taskMiddleware: null,
          resourceMiddleware: null,
          events: null,
          tags: null,
        },
      })
    );

    expect(screen.getByText(/identity=none/)).toBeTruthy();
    expect(screen.getByText(/^optional$/)).toBeTruthy();
  });
});
