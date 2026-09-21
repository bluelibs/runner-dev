import React from "react";
import { BaseModal } from "./modals";
import { DocIcon } from "./common/DocIcon";
import { SECTION_SHORTCUT_KEYS } from "../hooks/useGlobalShortcuts";
import "./ShortcutsModal.scss";

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Array<{ id: string; label: string }>;
  shellAvailable: boolean;
}

interface ShortcutRow {
  keys: string[];
  description: string;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  sections,
  shellAvailable,
}) => {
  const general: ShortcutRow[] = [
    { keys: ["⌘", "K"], description: "Open command palette" },
    ...(shellAvailable
      ? [{ keys: ["⌃", "`"], description: "Open runtime shell" }]
      : []),
    { keys: ["?"], description: "Show this help" },
    { keys: ["Esc"], description: "Close dialog / back to list" },
  ];

  const jumps: ShortcutRow[] = sections
    .filter((section) => SECTION_SHORTCUT_KEYS[section.id])
    .map((section) => ({
      keys: ["g", SECTION_SHORTCUT_KEYS[section.id]],
      description: `Go to ${section.label}`,
    }));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard shortcuts"
      size="sm"
      className="shortcuts-modal__panel"
      ariaLabel="Keyboard shortcuts"
    >
      <div className="shortcuts-modal">
        <ShortcutGroup icon="command" title="General" shortcuts={general} />
        <ShortcutGroup
          icon="arrow-right"
          title="Go to section"
          shortcuts={jumps}
        />
      </div>
    </BaseModal>
  );
};

const ShortcutGroup: React.FC<{
  icon: string;
  title: string;
  shortcuts: ShortcutRow[];
}> = ({ icon, title, shortcuts }) => {
  if (shortcuts.length === 0) return null;
  return (
    <div className="shortcuts-modal__group">
      <h4 className="shortcuts-modal__group-title">
        <DocIcon name={icon} size={13} /> {title}
      </h4>
      <div className="shortcuts-modal__rows">
        {shortcuts.map((shortcut) => (
          <div key={`${shortcut.description}`} className="shortcuts-modal__row">
            <span className="shortcuts-modal__keys">
              {shortcut.keys.map((key, index) => (
                <kbd key={index} className="docs-kbd">
                  {key}
                </kbd>
              ))}
            </span>
            <span className="shortcuts-modal__description">
              {shortcut.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
