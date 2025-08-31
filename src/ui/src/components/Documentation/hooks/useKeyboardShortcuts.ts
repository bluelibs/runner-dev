import { useEffect } from "react";

type Options = {
  enabled?: boolean;
  onToggleChat?: () => void;
  onFocusInput?: () => void;
  onSend?: () => void;
  onStop?: () => void;
  onClear?: () => void;
};

export function useKeyboardShortcuts(opts: Options) {
  const { enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Toggle chat: Cmd/Ctrl+Shift+A
      if (isMeta && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        opts.onToggleChat?.();
        return;
      }

      // Focus input: Cmd/Ctrl+I
      if (isMeta && (e.key === "I" || e.key === "i")) {
        e.preventDefault();
        opts.onFocusInput?.();
        return;
      }

      // Send: Cmd/Ctrl+Enter
      if (isMeta && e.key === "Enter") {
        e.preventDefault();
        opts.onSend?.();
        return;
      }

      // Stop: Esc
      if (e.key === "Escape") {
        opts.onStop?.();
        return;
      }

      // Clear: Cmd/Ctrl+K
      if (isMeta && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        opts.onClear?.();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, opts]);
}
