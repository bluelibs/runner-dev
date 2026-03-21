import type { Introspector } from "../../../resources/models/Introspector";
import { isRunnerNamespaceId } from "../../../utils/runner-namespace";
import { isSystemNamespaceId } from "../../../utils/system-namespace";

export interface DocsVisibilityState {
  showSystem: boolean;
  showRunner: boolean;
  showPrivate: boolean;
}

interface IntrospectorEntry {
  id: string;
  isPrivate?: boolean;
}

export function getHashTargetElementId(hash: string | null | undefined) {
  if (!hash) return null;
  const id = safeDecodeURIComponent(hash.slice(1));
  if (!id) return null;
  if (id.startsWith("element-")) return id.slice("element-".length);
  return id;
}

export function getVisibilityStateForHashTarget(
  introspector: Introspector,
  targetId: string | null,
  current: DocsVisibilityState
): DocsVisibilityState {
  if (!targetId) return current;

  const target = introspector
    .getAll()
    .find((entry: { id: string }) => entry.id === targetId) as
    | IntrospectorEntry
    | undefined;

  if (!target) return current;

  return {
    showSystem:
      current.showSystem || isSystemNamespaceId(target.id) ? true : false,
    showRunner:
      current.showRunner || isRunnerNamespaceId(target.id) ? true : false,
    showPrivate:
      current.showPrivate || target.isPrivate === true ? true : false,
  };
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
