
import React, { useState } from 'react';
import './JsonViewer.scss';

interface JsonViewerProps {
  data: object;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>(() => {
    const keys: string[] = [];
    const collectKeys = (obj: any, path: string, depth: number) => {
      if (depth >= 4 || typeof obj !== 'object' || obj === null) return;
      keys.push(path);
      Object.keys(obj).forEach(key => {
        collectKeys(obj[key], `${path}.${key}`, depth + 1);
      });
    };
    collectKeys(data, 'root', 0);
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
          <span className="json-bracket">{isArray ? '[' : '{'}</span>
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
          <span className="json-bracket">{isArray ? ']' : '}'}</span>
        </div>
      );
    } else {
      const stringValue = JSON.stringify(value);
      const maxLength = 100;
      
      if (typeof value === 'string' && stringValue.length > maxLength) {
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
                style={{ cursor: 'pointer', color: '#0066cc', marginLeft: '4px' }}
              >
                ...
              </span>
            )}
            {isExpanded && stringValue.length > maxLength && (
              <span 
                className="json-collapse-text" 
                onClick={() => toggleText(path)}
                style={{ cursor: 'pointer', color: '#0066cc', marginLeft: '4px' }}
              >
                [collapse]
              </span>
            )}
          </span>
        );
      } else {
        return <span className={`json-value json-value--${typeof value}`}>{stringValue}</span>;
      }
    }
  };

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return null;
  }

  return <div className="json-viewer">{renderValue(data, 'root')}</div>;
};

export default JsonViewer;
