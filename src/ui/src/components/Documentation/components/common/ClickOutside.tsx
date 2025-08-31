import React, { useEffect, useRef } from "react";

export interface ClickOutsideProps {
  children: React.ReactNode;
  onClickOutside: (event?: MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  enabled?: boolean;
}

export const ClickOutside: React.FC<ClickOutsideProps> = ({
  children,
  onClickOutside,
  className = "",
  style,
  enabled = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) {
        onClickOutside(event);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [enabled, onClickOutside]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
};
