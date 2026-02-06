import React, { useState, useRef, useEffect } from "react";
import "./Tooltip.scss";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 300,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        setCoords({ x: rect.left + rect.width / 2, y: rect.top });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && tooltipRef.current && targetRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      let left = coords.x;
      let top = coords.y;

      // Adjust position based on the position prop
      switch (position) {
        case "top":
          left = coords.x - tooltipRect.width / 2;
          top = targetRect.top - tooltipRect.height - 8;
          break;
        case "bottom":
          left = coords.x - tooltipRect.width / 2;
          top = targetRect.bottom + 8;
          break;
        case "left":
          left = targetRect.left - tooltipRect.width - 8;
          top = coords.y - tooltipRect.height / 2;
          break;
        case "right":
          left = targetRect.right + 8;
          top = coords.y - tooltipRect.height / 2;
          break;
      }

      // Keep tooltip within viewport bounds
      const padding = 8;
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

      tooltipRef.current.style.left = `${left}px`;
      tooltipRef.current.style.top = `${top}px`;
    }
  }, [isVisible, coords, position]);

  return (
    <>
      <span
        ref={targetRef}
        className={`docs-tooltip-trigger ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </span>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`docs-tooltip docs-tooltip--${position}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </>
  );
};