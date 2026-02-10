import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useModalStack, type ModalId } from "./ModalStackContext";
import "./BaseModal.scss";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModalSize = "sm" | "md" | "lg" | "xl" | "fullscreen";

export interface BaseModalProps {
  /** Controls visibility. When `false` the modal is unmounted entirely. */
  isOpen: boolean;
  /** Called when the user requests closing the modal (Escape, backdrop click). */
  onClose: () => void;
  /** Optional title rendered in the default header. If `renderHeader` is
   *  provided, this is ignored. */
  title?: string;
  /** Optional subtitle shown below the title. */
  subtitle?: string;
  /** Preset size of the dialog panel. Defaults to `"lg"`. */
  size?: ModalSize;
  /** Whether clicking the backdrop should close the modal. Defaults to `true`. */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape should close the modal. Defaults to `true`.
   *  Note: Escape handling is delegated to the `ModalStackProvider` and only
   *  fires on the *topmost* modal. Setting this to `false` prevents that. */
  closeOnEscape?: boolean;
  /** Enable focus-trap inside the dialog. Defaults to `true`. */
  trapFocus?: boolean;
  /** Animate entrance & exit. Defaults to `true`. */
  animate?: boolean;
  /** Extra CSS class on the dialog panel. */
  className?: string;
  /** ARIA label override. Falls back to `title`. */
  ariaLabel?: string;
  /** Replace the entire header. Return `null` to hide the header entirely. */
  renderHeader?: (props: { onClose: () => void }) => React.ReactNode;
  /** The dialog body content. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lock scroll on `document.body` and return a restorer function. */
function lockBodyScroll(): () => void {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const original = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflowY: document.body.style.overflowY,
  };

  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.overflowY = "scroll";

  return () => {
    document.body.style.position = original.position;
    document.body.style.top = original.top;
    document.body.style.left = original.left;
    document.body.style.right = original.right;
    document.body.style.width = original.width;
    document.body.style.overflowY = original.overflowY;
    window.scrollTo(0, scrollY);
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "lg",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  trapFocus = true,
  animate = true,
  className,
  ariaLabel,
  renderHeader,
  children,
}) => {
  const stack = useModalStack();
  const modalIdRef = useRef<ModalId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // ------- Stack registration -------
  // We wrap onClose so Escape via the stack only fires for modals that want it.
  const guardedClose = useCallback(() => {
    if (closeOnEscape) onClose();
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      modalIdRef.current = stack.push(guardedClose);
    }
    return () => {
      if (modalIdRef.current) {
        stack.remove(modalIdRef.current);
        modalIdRef.current = null;
      }
    };
  }, [isOpen, guardedClose, stack]);

  // ------- Scroll lock (first modal only) -------
  useEffect(() => {
    if (!isOpen) return;
    const restore = lockBodyScroll();
    return restore;
  }, [isOpen]);

  // ------- Focus management -------
  useEffect(() => {
    if (!isOpen || !trapFocus) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Focus the first focusable element inside the panel.
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      try {
        previouslyFocused.current?.focus();
      } catch {
        // intentionally empty
      }
    };
  }, [isOpen, trapFocus]);

  // ------- Render nothing when closed -------
  if (!isOpen) return null;

  const zIndex = modalIdRef.current
    ? stack.zIndexFor(modalIdRef.current)
    : 10000;

  const header =
    renderHeader !== undefined ? (
      renderHeader({ onClose })
    ) : title ? (
      <div className="base-modal__header">
        <div className="base-modal__titles">
          <h3 className="base-modal__title">{title}</h3>
          {subtitle && <div className="base-modal__subtitle">{subtitle}</div>}
        </div>
        <div className="base-modal__header-right">
          <span className="base-modal__esc-hint">ESC to close</span>
          <button
            className="base-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
      </div>
    ) : (
      <div className="base-modal__header base-modal__header--minimal">
        <div className="base-modal__header-right">
          <span className="base-modal__esc-hint">ESC to close</span>
          <button
            className="base-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
      </div>
    );

  return createPortal(
    <div
      className={`base-modal__backdrop${
        animate ? " base-modal__backdrop--animate" : ""
      }`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || "Modal dialog"}
      onMouseDown={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={[
          "base-modal__panel",
          `base-modal__panel--${size}`,
          animate ? "base-modal__panel--animate" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        <div className="base-modal__body">{children}</div>
      </div>
    </div>,
    document.body
  );
};
