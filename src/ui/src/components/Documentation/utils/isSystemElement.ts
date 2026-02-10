import { DOCUMENTATION_CONSTANTS } from "../config/documentationConstants";

/**
 * Determines whether an element is a "system" element.
 * An element is system if its tags include the system tag id,
 * or if the element itself IS the system tag.
 */
export function isSystemElement(
  el:
    | {
        id: string;
        tags?: string[] | null;
      }
    | null
    | undefined
): boolean {
  if (!el) return false;
  if (Array.isArray(el.tags)) {
    return el.tags.includes(DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID);
  }
  return el.id === DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID;
}
