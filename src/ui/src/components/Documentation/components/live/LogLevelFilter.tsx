import React, { useEffect, useId, useRef, useState } from "react";
import type { LogLevel } from "../../../../../../resources/live/types";
import { ClickOutside } from "../common/ClickOutside";
import { DocIcon } from "../common/DocIcon";
import "./LogLevelFilter.scss";

export type LevelFilter = "" | LogLevel;

const levels = new Map<LevelFilter, string>([
  ["", "All levels"],
  ["error", "Errors · grouped"],
  ["warn", "Warning"],
  ["info", "Info"],
  ["debug", "Debug"],
  ["trace", "Trace"],
  ["critical", "Critical"],
  ["fatal", "Fatal"],
  ["log", "Log"],
]);
const options = Array.from(levels.entries());

export function LogLevelFilter({
  value,
  onChange,
}: {
  value: LevelFilter;
  onChange: (level: LevelFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
  }, [open]);

  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }

  function navigate(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % options.length;
        break;
      case "ArrowUp":
        next = (index + options.length - 1) % options.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    menu.current?.querySelectorAll<HTMLButtonElement>("button")[next].focus();
  }

  return (
    <ClickOutside
      className="log-filter"
      enabled={open}
      onClickOutside={() => setOpen(false)}
    >
      <button
        type="button"
        ref={trigger}
        className="log-filter__trigger"
        data-active={Boolean(value)}
        aria-label={`Filter log level, ${levels.get(value)}`}
        title={`Filter log level · ${levels.get(value)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <DocIcon name="filter" size={16} />
        {value && <span>{levels.get(value)}</span>}
      </button>
      {open && (
        <div
          className="log-filter__menu"
          role="menu"
          aria-label="Log level"
          id={menuId}
          ref={menu}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget) &&
              event.relatedTarget !== trigger.current
            )
              setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              dismiss();
            }
            if (event.key === "Tab") {
              dismiss();
            }
          }}
        >
          <div className="log-filter__heading">Log level</div>
          {options.map(([level, label], index) => (
            <button
              type="button"
              key={level}
              role="menuitemradio"
              aria-checked={value === level}
              tabIndex={-1}
              onKeyDown={(event) => navigate(event, index)}
              onClick={() => {
                onChange(level);
                dismiss();
              }}
            >
              <span>{label}</span>
              {value === level && <DocIcon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </ClickOutside>
  );
}
