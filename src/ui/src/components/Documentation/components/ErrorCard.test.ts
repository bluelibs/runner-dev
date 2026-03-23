/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { Error as ErrorModel } from "../../../../../schema/model";
import type { Introspector } from "../../../../../resources/models/Introspector";
import { ErrorCard } from "./ErrorCard";

jest.mock("./ErrorCard.scss", () => ({}), { virtual: true });
jest.mock("./SchemaRenderer.scss", () => ({}), { virtual: true });
jest.mock("./common/StructuredDataPanel.scss", () => ({}), { virtual: true });
jest.mock("./CodeModal", () => ({
  CodeModal: () => null,
}));
jest.mock("./TagsSection", () => ({
  TagsSection: () => null,
}));
jest.mock("./common/ElementKindBadge", () => ({
  ElementKindBadge: () => React.createElement("span", null, "error"),
  SystemBadge: () => React.createElement("span", null, "system"),
}));
jest.mock("./common/RegisteredByInfoBlock", () => ({
  RegisteredByInfoBlock: () => null,
}));
jest.mock("./chat/ChatUtils", () => ({
  copyToClipboard: jest.fn(async () => true),
}));
jest.mock("./JsonViewer", () => ({
  __esModule: true,
  default: ({ data }: { data: object }) =>
    React.createElement(
      "div",
      { "data-testid": "json-viewer" },
      JSON.stringify(data)
    ),
}));
jest.mock("../utils/graphqlClient", () => ({
  graphqlRequest: jest.fn(),
  SAMPLE_ERROR_FILE_QUERY: "",
}));

function createIntrospectorMock(): Introspector {
  return {
    getTasksUsingError: () => [],
    getResourcesUsingError: () => [],
    getHooksUsingError: () => [],
    getMiddlewaresUsingError: () => [],
    getTagsByIds: () => [],
  } as unknown as Introspector;
}

function createError(dataSchema?: string): ErrorModel {
  return {
    id: "http-bad-request",
    filePath: "/tmp/httpBadRequest.error.ts",
    dataSchema,
    meta: {
      title: "HTTP Bad Request",
      description: "Typed validation failure.",
    },
    tags: [],
  } as unknown as ErrorModel;
}

describe("ErrorCard", () => {
  it.each([
    { label: "empty string", dataSchema: "" },
    { label: "undefined", dataSchema: undefined },
  ])(
    "renders the empty schema state for $label dataSchema",
    ({ dataSchema }) => {
      render(
        React.createElement(ErrorCard, {
          error: createError(dataSchema),
          introspector: createIntrospectorMock(),
        })
      );

      expect(screen.getByText("Error Data Schema")).toBeInTheDocument();
      expect(screen.getAllByText("No schema defined").length).toBeGreaterThan(
        0
      );
    }
  );
});
