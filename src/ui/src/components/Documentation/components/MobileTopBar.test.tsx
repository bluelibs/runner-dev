import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileTopBar } from "./MobileTopBar";

describe("MobileTopBar", () => {
  it("offers to open navigation while the drawer is closed", () => {
    const onToggleNav = jest.fn();
    render(
      <MobileTopBar
        isNavOpen={false}
        onToggleNav={onToggleNav}
        onOpenPalette={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Open navigation" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("docs-sidebar");

    fireEvent.click(toggle);
    expect(onToggleNav).toHaveBeenCalledTimes(1);
  });

  it("offers to close navigation while the drawer is open", () => {
    render(
      <MobileTopBar
        isNavOpen={true}
        onToggleNav={() => {}}
        onOpenPalette={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Close navigation" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the search palette", () => {
    const onOpenPalette = jest.fn();
    render(
      <MobileTopBar
        isNavOpen={false}
        onToggleNav={() => {}}
        onOpenPalette={onOpenPalette}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Search or jump to anything" })
    );
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
});
