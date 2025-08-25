import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoScroll(
  scrollRef: React.RefObject<HTMLDivElement>,
  deps: unknown[]
) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const rafId = useRef<number | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  // Track manual scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 32; // px tolerance
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      setIsAtBottom(atBottom);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Auto scroll on deps if at bottom
  useEffect(() => {
    if (!isAtBottom) return;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      scrollToBottom();
      Promise.resolve().then(() => scrollToBottom());
    });
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAtBottom, scrollToBottom, ...deps]);

  return { isAtBottom, scrollToBottom };
}
