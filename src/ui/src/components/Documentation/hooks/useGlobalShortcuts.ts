import { useEffect, useRef } from "react";
import { recordInputModality } from "../utils/inputModality";

export interface GlobalShortcutHandlers {
  onOpenPalette: () => void;
  onOpenShell: () => void;
  onOpenShortcuts: () => void;
  onNavigateSection: (sectionId: string) => void;
  /** Return true when the key was consumed (e.g. back from a detail view). */
  onEscape: () => boolean;
  /** True while any modal overlay (palette, shell, help) is open. */
  isOverlayOpen: () => boolean;
}

/** `g` + key section jumps. Letters double as palette keywords. */
export const SECTION_SHORTCUT_KEYS: Record<string, string> = {
  overview: "o",
  tasks: "t",
  resources: "r",
  events: "e",
  hooks: "h",
  middlewares: "m",
  live: "l",
  diagnostics: "d",
  topology: "y",
  errors: "x",
  asyncContexts: "c",
  tags: "a",
};

const PENDING_KEY_TIMEOUT_MS = 1500;

function isTypingTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  ) {
    return true;
  }
  return Boolean(target.closest(".cm-editor, .cm-content"));
}

/**
 * App-wide keyboard shortcuts: command palette, shell, help,
 * `g`-prefixed section jumps, and detail-view escape. Typing in inputs is
 * never hijacked (except for palette toggle and escape, which always work).
 * Also records the last input modality so keyboard-driven navigation does
 * not land focus in a table search (see inputModality).
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const pendingKeyRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearPendingKey = () => {
      pendingKeyRef.current = null;
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      recordInputModality("keyboard");
      const current = handlersRef.current;
      const overlayOpen = current.isOverlayOpen();
      const typing = isTypingTarget(event.target);

      // Command palette toggle always works, even while typing.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        clearPendingKey();
        current.onOpenPalette();
        return;
      }

      // Shell toggle keeps working everywhere except inside the shell editor.
      if ((event.metaKey || event.ctrlKey) && event.key === "`") {
        if (typing) return;
        event.preventDefault();
        clearPendingKey();
        current.onOpenShell();
        return;
      }

      if (event.key === "Escape") {
        if (overlayOpen) return;
        clearPendingKey();
        if (isTypingTarget(event.target)) {
          // While typing, Escape only leaves the field; field-level handlers
          // (e.g. the sidebar filter) still run after this capture listener.
          event.target.blur();
          return;
        }
        if (current.onEscape()) {
          event.stopPropagation();
        }
        return;
      }

      if (typing || overlayOpen) {
        if (pendingKeyRef.current) clearPendingKey();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // `g` starts a section jump; the next key completes it.
      if (pendingKeyRef.current === "g") {
        const key = event.key.toLowerCase();
        const sectionId = Object.entries(SECTION_SHORTCUT_KEYS).find(
          ([, shortcutKey]) => shortcutKey === key
        )?.[0];
        clearPendingKey();
        if (sectionId) {
          event.preventDefault();
          current.onNavigateSection(sectionId);
        }
        return;
      }

      if (event.key === "g") {
        // A pending key always carries its timer, so reaching here with no
        // pending key means no timer is armed either.
        pendingKeyRef.current = "g";
        pendingTimerRef.current = window.setTimeout(
          clearPendingKey,
          PENDING_KEY_TIMEOUT_MS
        );
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        current.onOpenShortcuts();
        return;
      }
    };

    const handlePointerDown = () => recordInputModality("pointer");

    // Capture phase: observe overlay state before the modal stack consumes
    // Escape in bubble phase, so one keypress never both closes a modal and
    // navigates. Stopping propagation only when we consume the key keeps
    // field-level and modal Escape behavior intact.
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      clearPendingKey();
    };
  }, []);
}
