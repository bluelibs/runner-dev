/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import JsonViewer from "./JsonViewer";

jest.mock("./JsonViewer.scss", () => ({}), { virtual: true });

const sample = {
  supplierId: "kz6moog60hj5o2g4c06y3omo6t4scye3",
  changedSkus: ["sku-demo-001", "sku-demo-002"],
  source: undefined,
  updatedAt: "2026-09-20T15:46:50.558Z",
};

describe("JsonViewer", () => {
  it("renders nested keys and values", () => {
    render(React.createElement(JsonViewer, { data: sample }));

    expect(screen.getByText('"supplierId":')).toBeTruthy();
    expect(screen.getByText('"kz6moog60hj5o2g4c06y3omo6t4scye3"')).toBeTruthy();
    expect(screen.getByText('"changedSkus":')).toBeTruthy();
    expect(screen.getByText('"sku-demo-001"')).toBeTruthy();
    expect(screen.getByText('"updatedAt":')).toBeTruthy();
  });

  it("places the container comma after the closing bracket", () => {
    const { container } = render(
      React.createElement(JsonViewer, { data: sample })
    );

    const arrayNode = [...container.querySelectorAll(".json-node")].find(
      (node) => node.querySelector(".json-bracket--open")?.textContent === "["
    );
    expect(arrayNode).toBeTruthy();

    // The opening bracket is followed by the children block, never by a
    // stray comma (the flex-sibling bug put it next to `[`).
    const openBracket = arrayNode?.querySelector(".json-bracket--open");
    expect(openBracket?.nextElementSibling?.className).toBe("json-children");

    // The comma lives after the closing bracket instead.
    const closeBracket = arrayNode?.querySelector(".json-bracket--close");
    expect(closeBracket?.textContent).toBe("]");
    const comma = closeBracket?.nextElementSibling;
    expect(comma?.className).toBe("json-comma");
    expect(comma?.textContent).toBe(",");
  });

  it("renders undefined values explicitly instead of blank", () => {
    render(React.createElement(JsonViewer, { data: sample }));

    const undefinedValues = screen.getAllByText("undefined", {
      selector: ".json-value--undefined",
    });
    expect(undefinedValues).toHaveLength(1);
  });

  it("collapses a container when its toggle is clicked", () => {
    render(React.createElement(JsonViewer, { data: sample }));
    expect(screen.getByText('"sku-demo-001"')).toBeTruthy();

    const toggles = screen.getAllByText("▼");
    // Root toggle is first; the array toggle is second.
    fireEvent.click(toggles[1]);

    expect(screen.queryByText('"sku-demo-001"')).toBeNull();
    expect(screen.getByText("...")).toBeTruthy();
  });

  it("renders null instead of crashing without data", () => {
    const { container } = render(
      React.createElement(JsonViewer, { data: null as unknown as object })
    );
    expect(container.firstChild).toBeNull();
  });
});
