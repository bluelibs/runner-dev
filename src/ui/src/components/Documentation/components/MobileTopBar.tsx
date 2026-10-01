import React from "react";
import { DocIcon } from "./common/DocIcon";

export interface MobileTopBarProps {
  isNavOpen: boolean;
  onToggleNav: () => void;
  onOpenPalette: () => void;
}

/**
 * Phone-width header. On narrow screens the sidebar becomes an off-canvas
 * drawer, so this bar is the only always-visible way back to navigation and
 * search. It is always rendered and shown purely by CSS, which keeps the
 * server-rendered markup identical to the hydrated tree.
 */
export const MobileTopBar: React.FC<MobileTopBarProps> = ({
  isNavOpen,
  onToggleNav,
  onOpenPalette,
}) => (
  <header className="docs-mobile-topbar">
    <button
      type="button"
      className="docs-mobile-topbar__button"
      onClick={onToggleNav}
      aria-label={isNavOpen ? "Close navigation" : "Open navigation"}
      aria-expanded={isNavOpen}
      aria-controls="docs-sidebar"
    >
      <DocIcon name={isNavOpen ? "x" : "menu"} size={20} />
    </button>
    <span className="docs-mobile-topbar__title">Runner Dev</span>
    <button
      type="button"
      className="docs-mobile-topbar__button"
      onClick={onOpenPalette}
      aria-label="Search or jump to anything"
    >
      <DocIcon name="diagnostics" size={18} />
    </button>
  </header>
);
