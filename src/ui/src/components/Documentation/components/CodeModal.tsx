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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

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
          <button className="code-modal__close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="code-modal__content">
          <pre className="code-modal__pre">
            <code ref={codeRef} className="language-typescript">{code ?? "No content"}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
