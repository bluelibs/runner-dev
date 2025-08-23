
import React, { useState } from 'react';
import './JsonViewer.scss';

interface JsonViewerProps {
  data: object;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const renderValue = (value: any, path: string): React.ReactNode => {
    if (typeof value === 'object' && value !== null) {
      const isArray = Array.isArray(value);
      const keys = Object.keys(value);
      const isExpanded = expandedKeys.includes(path);

      return (
        <div className={`json-node ${isExpanded ? 'expanded' : ''}`}>
          <span className="json-toggle" onClick={() => toggleKey(path)}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span>{isArray ? '[' : '{'}</span>
          {isExpanded && (
            <div className="json-children">
              {keys.map((key, index) => (
                <div key={index} className="json-key-value">
                  {!isArray && <span className="json-key">"{key}":</span>}
                  {renderValue(value[key], `${path}.${key}`)}
                  {index < keys.length - 1 && <span>,</span>}
                </div>
              ))}
            </div>
          )}
          {!isExpanded && <span className="json-ellipsis">...</span>}
          <span>{isArray ? ']' : '}'}</span>
        </div>
      );
    } else {
      return <span className={`json-value json-value--${typeof value}`}>{JSON.stringify(value)}</span>;
    }
  };

  return <div className="json-viewer">{renderValue(data, 'root')}</div>;
};

export default JsonViewer;
