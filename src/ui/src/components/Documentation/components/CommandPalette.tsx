import React from "react";
import { BaseModal } from "./modals";
import { DocIcon } from "./common/DocIcon";
import {
  filterPaletteEntries,
  type PaletteEntry,
} from "../utils/commandPalette";
import "./CommandPalette.scss";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  entries: PaletteEntry[];
  onSelectEntry: (entry: PaletteEntry) => void;
}

const GROUP_LABELS: Record<PaletteEntry["kind"], string> = {
  element: "Elements",
  section: "Sections",
  action: "Actions",
};

function entryKey(entry: PaletteEntry): string {
  return `${entry.kind}:${entry.id}`;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  entries,
  onSelectEntry,
}) => {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeItemRef = React.useRef<HTMLButtonElement>(null);

  const filtered = React.useMemo(
    () => filterPaletteEntries(entries, query),
    [entries, query]
  );

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      const frame = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [isOpen]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    activeItemRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  const runEntry = React.useCallback(
    (entry: PaletteEntry) => {
      onSelectEntry(entry);
      onClose();
    },
    [onSelectEntry, onClose]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          filtered.length === 0 ? 0 : (index + 1) % filtered.length
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          filtered.length === 0
            ? 0
            : (index - 1 + filtered.length) % filtered.length
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = filtered[activeIndex];
        if (selected) runEntry(selected.entry);
      }
    },
    [filtered, activeIndex, runEntry]
  );

  let lastGroup: PaletteEntry["kind"] | null = null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="command-palette__modal"
      ariaLabel="Command palette"
      renderHeader={() => null}
    >
      <div className="command-palette" onKeyDown={handleKeyDown}>
        <div className="command-palette__input-row">
          <span className="command-palette__input-icon">
            <DocIcon name="diagnostics" size={15} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette__input"
            placeholder="Search elements, sections, actions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search commands and elements"
          />
          {query && (
            <button
              type="button"
              className="command-palette__clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <DocIcon name="x" size={13} />
            </button>
          )}
          <span className="command-palette__esc">
            <kbd className="docs-kbd">esc</kbd>
          </span>
        </div>
        <div className="command-palette__results" role="listbox">
          {filtered.length === 0 && (
            <div className="command-palette__empty">
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
          {filtered.map(({ entry }, index) => {
            const showGroupHeader = entry.kind !== lastGroup;
            lastGroup = entry.kind;
            const isActive = index === activeIndex;
            return (
              <React.Fragment key={entryKey(entry)}>
                {showGroupHeader && (
                  <div className="command-palette__group">
                    {GROUP_LABELS[entry.kind]}
                  </div>
                )}
                <button
                  ref={isActive ? activeItemRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`command-palette__item ${
                    isActive ? "command-palette__item--active" : ""
                  }`}
                  onClick={() => runEntry(entry)}
                  onMouseMove={() => {
                    if (!isActive) setActiveIndex(index);
                  }}
                >
                  <PaletteItemIcon entry={entry} />
                  <PaletteItemLabel entry={entry} />
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="command-palette__footer">
          <span>
            <kbd className="docs-kbd">↑</kbd>
            <kbd className="docs-kbd">↓</kbd> navigate
          </span>
          <span>
            <kbd className="docs-kbd">↵</kbd> select
          </span>
          <span>
            <kbd className="docs-kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </BaseModal>
  );
};

const PaletteItemIcon: React.FC<{ entry: PaletteEntry }> = ({ entry }) => {
  const name =
    entry.kind === "element"
      ? entry.elementKind
      : entry.kind === "section"
      ? entry.icon
      : entry.icon;
  return (
    <span className="command-palette__item-icon">
      <DocIcon name={name} size={14} />
    </span>
  );
};

const PaletteItemLabel: React.FC<{ entry: PaletteEntry }> = ({ entry }) => {
  if (entry.kind === "element") {
    return (
      <span className="command-palette__item-label">
        <span className="command-palette__item-primary">
          {entry.title || entry.id}
        </span>
        {entry.title && (
          <span className="command-palette__item-secondary">{entry.id}</span>
        )}
        <span className="command-palette__item-kind">{entry.elementKind}</span>
      </span>
    );
  }
  if (entry.kind === "section") {
    return (
      <span className="command-palette__item-label">
        <span className="command-palette__item-primary">
          Go to {entry.label}
        </span>
      </span>
    );
  }
  return (
    <span className="command-palette__item-label">
      <span className="command-palette__item-primary">{entry.label}</span>
      {entry.shortcut && (
        <kbd className="docs-kbd command-palette__item-shortcut">
          {entry.shortcut}
        </kbd>
      )}
    </span>
  );
};
