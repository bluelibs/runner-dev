import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Unique token returned by `push()` so the caller can dismiss exactly their modal. */
export type ModalId = string;

/** Information tracked per stacked modal layer. */
export interface ModalEntry {
  /** Stable identifier for this modal layer. */
  id: ModalId;
  /** Called when the stack decides this modal should close (e.g. Escape). */
  onClose: () => void;
}

export interface ModalStackContextValue {
  /** Register a new modal on top of the stack. Returns the assigned `ModalId`. */
  push: (onClose: () => void) => ModalId;
  /** Remove a modal by its id (idempotent). */
  remove: (id: ModalId) => void;
  /** How many modals are currently open. */
  depth: number;
  /** z-index base for the *topmost* modal. Each layer gets `BASE + depth * STEP`. */
  zIndexFor: (id: ModalId) => number;
  /** Whether the given modal is currently the topmost one. */
  isTop: (id: ModalId) => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The starting z-index for the first modal. Each subsequent stacked modal
 *  increases by `Z_INDEX_STEP`. */
const Z_INDEX_BASE = 10000;
const Z_INDEX_STEP = 10;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let nextId = 0;
function generateId(): ModalId {
  return `modal-${++nextId}`;
}

export const ModalStackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stack, setStack] = useState<ModalEntry[]>([]);

  // Ref mirror so Escape handler always sees latest stack without re-binding.
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const push = useCallback((onClose: () => void): ModalId => {
    const id = generateId();
    setStack((prev) => [...prev, { id, onClose }]);
    return id;
  }, []);

  const remove = useCallback((id: ModalId) => {
    setStack((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const depth = stack.length;

  const zIndexFor = useCallback(
    (id: ModalId): number => {
      const idx = stack.findIndex((entry) => entry.id === id);
      if (idx === -1) return Z_INDEX_BASE;
      return Z_INDEX_BASE + idx * Z_INDEX_STEP;
    },
    [stack]
  );

  const isTop = useCallback(
    (id: ModalId): boolean => {
      if (stack.length === 0) return false;
      return stack[stack.length - 1].id === id;
    },
    [stack]
  );

  // Global Escape handler — always closes the topmost modal.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const current = stackRef.current;
      if (current.length === 0) return;
      // Close the topmost modal.
      const top = current[current.length - 1];
      top.onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo<ModalStackContextValue>(
    () => ({ push, remove, depth, zIndexFor, isTop }),
    [push, remove, depth, zIndexFor, isTop]
  );

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Access the modal-stack context. Throws if used outside a `ModalStackProvider`. */
export function useModalStack(): ModalStackContextValue {
  const ctx = useContext(ModalStackContext);
  if (!ctx) {
    throw new Error(
      "useModalStack() must be used inside a <ModalStackProvider>"
    );
  }
  return ctx;
}
