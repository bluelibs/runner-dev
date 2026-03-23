import type { Introspector } from "../../../../../resources/models/Introspector";

export function resolveReferenceElement(
  introspector: Introspector,
  id: string
) {
  return (
    introspector.getTask(id) ??
    introspector.getHook(id) ??
    introspector.getResource(id) ??
    introspector.getEvent(id) ??
    introspector.getMiddleware(id) ??
    introspector.getError(id) ??
    introspector.getAsyncContext(id) ??
    introspector.getTag(id) ?? {
      id,
      registeredBy: null,
    }
  );
}
