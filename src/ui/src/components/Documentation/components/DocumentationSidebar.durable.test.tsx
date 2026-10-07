import React from "react";
import { render, screen } from "@testing-library/react";
import { DocumentationSidebar } from "./DocumentationSidebar";
import { DocumentationModeProvider } from "../context/DocumentationModeContext";
import type { DocumentationMode } from "../../../../../resources/docsPayload";

jest.mock("./NavigationView", () => ({ NavigationView: () => null }));

function renderSidebar(hasDurable?: boolean, mode: DocumentationMode = "live") {
  return render(
    <DocumentationModeProvider mode={mode}>
      <DocumentationSidebar
        hasDurable={hasDurable}
        sidebarWidth={280}
        sidebarRef={React.createRef<HTMLElement>()}
        viewMode="list"
        treeType="namespace"
        showSystem={false}
        showRunner={false}
        showPrivate={false}
        treeNodes={[]}
        sections={[]}
        onViewModeChange={() => {}}
        onTreeTypeChange={() => {}}
        onShowSystemChange={() => {}}
        onShowRunnerChange={() => {}}
        onShowPrivateChange={() => {}}
        onTreeNodeClick={() => {}}
        onToggleExpansion={() => {}}
        onSectionClick={() => {}}
        onOpenPalette={() => {}}
        onOpenShortcuts={() => {}}
      />
    </DocumentationModeProvider>
  );
}

test.each([undefined, false])(
  "hides Durable when availability is %s",
  (available) => {
    renderSidebar(available);
    expect(screen.queryByRole("link", { name: "Durable" })).toBeNull();
  }
);

test("opens the durable route when the backend reports a runtime", () => {
  renderSidebar(true);
  expect(
    screen.getByRole("link", { name: "Durable" }).getAttribute("href")
  ).toBe("/durable");
});

test("hides live durable navigation in static catalogs", () => {
  renderSidebar(true, "catalog");
  expect(screen.queryByRole("link", { name: "Durable" })).toBeNull();
});
