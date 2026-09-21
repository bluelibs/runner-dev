import React, { useState } from "react";
import "./JsonViewer.scss";

interface JsonViewerProps {
  data: object;
  className?: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, className }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => {
    const keys: string[] = [];
    const collectKeys = (obj: any, path: string, depth: number) => {
      if (depth >= 4 || typeof obj !== "object" || obj === null) return;
      keys.push(path);
      Object.keys(obj).forEach((key) => {
        collectKeys(obj[key], `${path}.${key}`, depth + 1);
      });
    };
    collectKeys(data, "root", 0);
    return keys;
  });
  const [expandedTexts, setExpandedTexts] = useState<string[]>([]);

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleText = (path: string) => {
    setExpandedTexts((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  // The trailing comma belongs to the value: for containers it must render
  // after the closing bracket, not as a flex sibling (which lands it next
  // to the opening bracket when children wrap below).
  const renderComma = (show: boolean): React.ReactNode =>
    show ? <span className="json-comma">,</span> : null;

  const renderValue = (
    value: any,
    path: string,
    showComma: boolean = false
  ): React.ReactNode => {
    if (typeof value === "object" && value !== null) {
      const isArray = Array.isArray(value);
      const keys = Object.keys(value);
      const isExpanded = expandedKeys.includes(path);

      return (
        <div className={`json-node ${isExpanded ? "expanded" : ""}`}>
          <span className="json-toggle" onClick={() => toggleKey(path)}>
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="json-bracket json-bracket--open">
            {isArray ? "[" : "{"}
          </span>
          {isExpanded && (
            <div className="json-children">
              {keys.map((key, index) => (
                <div key={index} className="json-key-value">
                  {!isArray && <span className="json-key">"{key}":</span>}
                  {renderValue(
                    value[key],
                    `${path}.${key}`,
                    index < keys.length - 1
                  )}
                </div>
              ))}
            </div>
          )}
          {!isExpanded && <span className="json-ellipsis">...</span>}
          <span className="json-bracket json-bracket--close">
            {isArray ? "]" : "}"}
          </span>
          {renderComma(showComma)}
        </div>
      );
    } else if (value === undefined) {
      return (
        <span className="json-value json-value--undefined">
          undefined{renderComma(showComma)}
        </span>
      );
    } else {
      const stringValue = JSON.stringify(value);
      const maxLength = 100;

      if (typeof value === "string" && stringValue.length > maxLength) {
        const isExpanded = expandedTexts.includes(path);
        const displayValue = isExpanded
          ? stringValue
          : stringValue.substring(0, maxLength);

        return (
          <span className={`json-value json-value--${typeof value}`}>
            {displayValue}
            {!isExpanded && (
              <span
                className="json-expand-text"
                onClick={() => toggleText(path)}
                style={{
                  cursor: "pointer",
                  color: "var(--docs-text-secondary)",
                  marginLeft: "4px",
                }}
              >
                ...
              </span>
            )}
            {isExpanded && stringValue.length > maxLength && (
              <span
                className="json-collapse-text"
                onClick={() => toggleText(path)}
                style={{
                  cursor: "pointer",
                  color: "var(--docs-text-secondary)",
                  marginLeft: "4px",
                }}
              >
                [collapse]
              </span>
            )}
            {renderComma(showComma)}
          </span>
        );
      } else {
        return (
          <span className={`json-value json-value--${typeof value}`}>
            {stringValue}
            {renderComma(showComma)}
          </span>
        );
      }
    }
  };

  if (!data) {
    return null;
  }

  const classes = ["json-viewer", className].filter(Boolean).join(" ");

  return <div className={classes}>{renderValue(data, "root")}</div>;
};

export default JsonViewer;
