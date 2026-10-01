import { useCallback, useEffect, useState } from "react";

/**
 * Open/closed state of the phone-width navigation drawer.
 *
 * The drawer covers the content, so it closes itself whenever the reader
 * navigates (hash change) or presses Escape — a tap on a destination should
 * land on that destination, not leave the menu in the way.
 */
export const useMobileNavDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("hashchange", close);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return { isOpen, open, close, toggle };
};
