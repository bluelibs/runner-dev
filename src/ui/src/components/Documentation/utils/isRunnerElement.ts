import { isRunnerNamespaceId } from "../../../../../utils/runner-namespace";

export function isRunnerElement(
  el:
    | {
        id: string;
      }
    | null
    | undefined
): boolean {
  if (!el) return false;
  return isRunnerNamespaceId(el.id);
}
