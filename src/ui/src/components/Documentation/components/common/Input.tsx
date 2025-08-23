import React, { useRef, useImperativeHandle, forwardRef } from "react";
import "./WriteCodeInput.scss";

interface AutocompleteItem {
  id: string;
  meta?: {
    title?: string;
    description?: string;
  };
}

interface InputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autocompleteItems?: AutocompleteItem[];
  showAutocomplete?: boolean;
  onSelectItem?: (item: AutocompleteItem) => void;
  className?: string;
}

export interface InputRef {
  focus: () => void;
}

export const WriteCodeInput = forwardRef<InputRef, InputProps>(({
  placeholder,
  value,
  onChange,
  onFocus,
  onBlur,
  autocompleteItems = [],
  showAutocomplete = false,
  onSelectItem,
  className = ""
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus()
  }));

  const handleItemClick = (item: AutocompleteItem) => {
    onSelectItem?.(item);
  };

  return (
    <div className={`input__autocomplete-container ${className}`}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="input__field"
      />
      {showAutocomplete && autocompleteItems.length > 0 && (
        <div className="input__autocomplete">
          {autocompleteItems.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="input__autocomplete-item"
              onClick={() => handleItemClick(item)}
            >
              <div className="input__autocomplete-id">
                {item.id}
              </div>
              {item.meta?.title && (
                <div className="input__autocomplete-title">
                  {item.meta.title}
                </div>
              )}
              {item.meta?.description && (
                <div className="input__autocomplete-description">
                  {item.meta.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

WriteCodeInput.displayName = "WriteCodeInput";