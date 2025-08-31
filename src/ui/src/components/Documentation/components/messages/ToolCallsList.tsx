import React from "react";
import "./ToolCallsList.scss";

export type ToolCallItem = {
  id: string;
  name?: string;
  argsPreview?: string;
  resultPreview?: string;
  status?: "pending" | "running" | "done" | "error";
};

export interface ToolCallsListProps {
  calls: ToolCallItem[];
  showStatus?: boolean;
  onOpenArguments?: (title: string, content: string) => void;
  onOpenResponse?: (title: string, content: string) => void;
}

export const ToolCallsList: React.FC<ToolCallsListProps> = ({
  calls,
  showStatus = true,
  onOpenArguments,
  onOpenResponse,
}) => {
  const visibleCalls = (calls || []).filter(Boolean);
  if (!visibleCalls.length) return null;

  return (
    <div className="tool-calls-list">
      {visibleCalls.map((t, i) => (
        <div
          key={t.id || i}
          className={`tool-call${t.status ? ` tool-call--${t.status}` : ""}`}
        >
          <div className="tool-call-row">
            {showStatus && (
              <div
                className={`tool-call-badge tool-call-badge--${
                  t.status || "pending"
                }`}
              >
                {t.status || "pending"}
              </div>
            )}
            <div className="tool-call-info">
              <div className="tool-call-name">{t.name || "tool"}</div>
              <div className="tool-call-actions">
                <button
                  className="tool-call-link"
                  onClick={() =>
                    t.argsPreview &&
                    onOpenArguments?.(
                      `${t.name || "tool"} — Arguments`,
                      t.argsPreview
                    )
                  }
                  disabled={!t.argsPreview}
                  aria-disabled={!t.argsPreview}
                >
                  Arguments
                </button>
                <button
                  className="tool-call-link"
                  onClick={() =>
                    t.resultPreview &&
                    onOpenResponse?.(
                      `${t.name || "tool"} — Response`,
                      t.resultPreview
                    )
                  }
                  disabled={!t.resultPreview}
                  aria-disabled={!t.resultPreview}
                >
                  Response
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
