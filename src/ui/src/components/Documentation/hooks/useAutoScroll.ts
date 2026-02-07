import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoScroll(
  scrollRef: React.RefObject<HTMLDivElement>,
  deps: unknown[]
) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const rafId = useRef<number | null>(null);
  const mounted = useRef(false);
  const initialScrollDone = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [scrollRef]);

  // Ensure we land at the bottom on mount/refresh regardless of current scroll
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Use two frames to allow content to render and heights to settle
    const id1 = requestAnimationFrame(() => {
      scrollToBottom();
      const id2 = requestAnimationFrame(() => scrollToBottom());
      rafId.current = id2;
    });
    rafId.current = id1;
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, []);

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
    // On the first deps-trigger after mount/content hydration, force a scroll
    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        scrollToBottom();
        Promise.resolve().then(() => scrollToBottom());
      });
      return () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = null;
      };
    }

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
  }, [isAtBottom, scrollToBottom, ...deps]);

  return { isAtBottom, scrollToBottom };
}
