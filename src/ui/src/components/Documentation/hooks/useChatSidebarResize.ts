import { useState, useCallback, useEffect, useRef } from "react";
import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";

export const useChatSidebarResize = (leftOffset: number) => {
  const [chatWidth, setChatWidth] = useState(() => {
    try {
      return parseInt(
        localStorage.getItem(
          DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_SIDEBAR_WIDTH
        ) || DOCUMENTATION_CONSTANTS.DEFAULTS.CHAT_SIDEBAR_WIDTH.toString(),
        10
      );
    } catch {
      return DOCUMENTATION_CONSTANTS.DEFAULTS.CHAT_SIDEBAR_WIDTH;
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
          DOCUMENTATION_CONSTANTS.CONSTRAINTS.MIN_CHAT_WIDTH
        ),
        DOCUMENTATION_CONSTANTS.CONSTRAINTS.MAX_CHAT_WIDTH
      );
      setChatWidth(newWidth);
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
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.CHAT_SIDEBAR_WIDTH,
        chatWidth.toString()
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [isResizing, chatWidth]);

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
    chatWidth,
    isResizing,
    sidebarRef,
    resizerRef,
    handleMouseDown,
  };
};
