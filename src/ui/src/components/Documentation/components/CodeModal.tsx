import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/plugins/line-numbers/prism-line-numbers";
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
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
  const originalBodyStyle = useRef<{
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflowY: string;
  }>({
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    overflowY: "",
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (!isOpen) return;

    const lockedScrollY = window.scrollY || window.pageYOffset || 0;

    // Store original styles
    originalBodyStyle.current = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflowY: document.body.style.overflowY,
    };

    // Robust scroll lock: prevent layout shift without padding hacks
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflowY = "scroll";

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore original styles and scroll position
      document.body.style.position = originalBodyStyle.current.position;
      document.body.style.top = originalBodyStyle.current.top;
      document.body.style.left = originalBodyStyle.current.left;
      document.body.style.right = originalBodyStyle.current.right;
      document.body.style.width = originalBodyStyle.current.width;
      document.body.style.overflowY = originalBodyStyle.current.overflowY;
      window.scrollTo(0, lockedScrollY);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && codeRef.current && code) {
      Prism.highlightElement(codeRef.current);
    }
  }, [isOpen, code]);

  if (!isOpen) return null;

  return createPortal(
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
          <pre className="code-modal__pre line-numbers">
            <code ref={codeRef} className="language-typescript">
              {code ?? "No content"}
            </code>
          </pre>
        </div>
      </div>
    </div>,
    document.body
  );
};
