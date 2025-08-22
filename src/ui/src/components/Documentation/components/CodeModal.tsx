import React, { useEffect, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/themes/prism-tomorrow.css";
import "./CodeModal.scss";

export interface CodeModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  code: string | null | undefined;
}

export const CodeModal: React.FC<CodeModalProps> = ({
  title,
  subtitle,
  isOpen,
  onClose,
  code,
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const originalBodyStyle = useRef<{ overflow: string; paddingRight: string }>({
    overflow: "",
    paddingRight: "",
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (isOpen) {
      // Store original styles
      originalBodyStyle.current = {
        overflow: document.body.style.overflow,
        paddingRight: document.body.style.paddingRight,
      };

      // Calculate scrollbar width only once when opening
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      window.addEventListener("keydown", onKey);
    } else {
      // Restore original styles
      document.body.style.overflow = originalBodyStyle.current.overflow;
      document.body.style.paddingRight = originalBodyStyle.current.paddingRight;
      window.removeEventListener("keydown", onKey);
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      // Only restore if modal was open
      if (isOpen) {
        document.body.style.overflow = originalBodyStyle.current.overflow;
        document.body.style.paddingRight =
          originalBodyStyle.current.paddingRight;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && codeRef.current && code) {
      Prism.highlightElement(codeRef.current);
    }
  }, [isOpen, code]);

  if (!isOpen) return null;

  return (
    <div className="code-modal__backdrop" onClick={onClose}>
      <div
        className="code-modal__dialog"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="code-modal__header">
          <div className="code-modal__titles">
            <h3 className="code-modal__title">{title}</h3>
            {subtitle && <div className="code-modal__subtitle">{subtitle}</div>}
          </div>
          <div className="code-modal__header-right">
            <div className="code-modal__esc-hint">Press ESC to Close</div>
            <button className="code-modal__close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>
        <div className="code-modal__content">
          <pre className="code-modal__pre">
            <code ref={codeRef} className="language-typescript">
              {code ?? "No content"}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
