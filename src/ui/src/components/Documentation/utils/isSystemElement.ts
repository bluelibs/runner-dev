import { isSystemNamespaceId } from "../../../../../utils/system-namespace";

/**
 * Determines whether an element is a "system" element.
 * An element is system when its id belongs to the system namespace.
 */
export function isSystemElement(
  el:
    | {
        id: string;
      }
    | null
    | undefined
): boolean {
  if (!el) return false;
  return isSystemNamespaceId(el.id);
}
