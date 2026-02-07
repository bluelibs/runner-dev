import { useState, useCallback, useEffect, useRef } from "react";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";

export const useSidebarResize = (leftOffset: number = 0) => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      return parseInt(
        localStorage.getItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SIDEBAR_WIDTH
        ) || DOCUMENTATION_CONSTANTS.DEFAULTS.SIDEBAR_WIDTH.toString(),
        10
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.SIDEBAR_WIDTH;
    }
  });

  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidthRaw = e.clientX - leftOffset;
      const newWidth = Math.min(
        Math.max(
          newWidthRaw,
          DOCUMENTATION_CONSTANTS.CONSTRAINTS.MIN_SIDEBAR_WIDTH
        ),
        DOCUMENTATION_CONSTANTS.CONSTRAINTS.MAX_SIDEBAR_WIDTH
      );
      setSidebarWidth(newWidth);
    },
    [isResizing, leftOffset]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return;

    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    try {
      localStorage.setItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SIDEBAR_WIDTH,
        sidebarWidth.toString()
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    sidebarWidth,
    isResizing,
    sidebarRef,
    resizerRef,
    handleMouseDown,
  };
};
