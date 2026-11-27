import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { StudioInputPreset } from "../../../../durable/shared/types";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const pending = useRef(busy);
  close.current = onClose;
  pending.current = busy;
  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const background = Array.from(document.body.children).filter(
      (element) => element !== backdrop.current
    );
    const previousInert = background.map((element) =>
      element.hasAttribute("inert")
    );
    background.forEach((element) => element.setAttribute("inert", ""));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
        ) ?? []
      ).filter(
        (element) =>
          !element.matches(":disabled") && !element.closest("[hidden]")
      );
    const focusFirst = () => (focusable()[0] ?? dialog.current)?.focus();
    if (!dialog.current?.contains(document.activeElement)) focusFirst();
    const onFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !dialog.current?.contains(event.target)
      )
        focusFirst();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!pending.current) close.current();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        const items = focusable();
        const index = items.findIndex(
          (item) => item === document.activeElement
        );
        const nextIndex =
          index < 0
            ? event.shiftKey
              ? items.length - 1
              : 0
            : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        (items[nextIndex] ?? dialog.current)?.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      background.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute("inert");
      });
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);

  useLayoutEffect(() => {
    // Disabling the focused submit button can move browser focus to the body.
    if (!dialog.current?.contains(document.activeElement))
      dialog.current?.focus();
  }, [busy]);

  return createPortal(
    <div
      ref={backdrop}
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="modal-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Back
        </button>
        <button
          type="button"
          className={`btn${danger ? " danger" : " primary"}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/** Preset picker + JSON editor with inline validation. */
export function JsonEditor({
  presets,
  value,
  validationMessage,
  onChange,
}: {
  presets: StudioInputPreset[];
  value: string;
  validationMessage?: string;
  onChange: (value: string, parsed: unknown, valid: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function apply(text: string) {
    try {
      const parsed: unknown = text.trim() === "" ? {} : JSON.parse(text);
      setError(null);
      onChange(text, parsed, true);
    } catch {
      setError("Invalid JSON — fix the syntax to continue.");
      onChange(text, undefined, false);
    }
  }

  return (
    <div className="json-editor">
      {validationMessage ? (
        <div className="schema-note">
          <span className="schema-note-mark" aria-hidden="true">
            ✓
          </span>
          <span>{validationMessage}</span>
        </div>
      ) : null}
      {presets.length > 0 ? (
        <div className="preset-group">
          <span className="preset-label">Load an example</span>
          <div className="preset-row">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="chip-btn"
                onClick={() => apply(JSON.stringify(preset.payload, null, 2))}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <textarea
        className="json-input"
        spellCheck={false}
        aria-label="JSON input"
        value={value}
        onChange={(event) => apply(event.target.value)}
        rows={10}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function ReasonDialog({
  title,
  message,
  confirmLabel,
  placeholder,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  placeholder: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} subtitle={message} onClose={onClose}>
      <label className="field">
        <span className="field-label">Reason</span>
        <input
          className="text-input"
          value={reason}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && reason.trim() !== "") {
              onConfirm(reason.trim());
            }
          }}
        />
      </label>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={reason.trim() === ""}
          onClick={() => onConfirm(reason.trim())}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
