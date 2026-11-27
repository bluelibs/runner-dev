import React from "react";
import "./LoadingSkeleton.css";

/** Keep the shape of the incoming content without announcing decorative bars. */
export function LoadingSkeleton({
  label,
  layout = "list",
  rows = 4,
}: {
  label: string;
  layout?: "metrics" | "list" | "detail";
  rows?: number;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`loading-skeleton loading-skeleton--${layout}`}
    >
      {Array.from({ length: layout === "metrics" ? 3 : rows }, (_, index) => (
        <div aria-hidden="true" className="loading-skeleton__row" key={index}>
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}
