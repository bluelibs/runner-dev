import type { TunnelInfo } from "../../schema/model";
import { readId } from "./introspector.tools";

/**
 * Extract tunnel info from a resource's resolved value.
 * The value is the result of the resource's init() function.
 *
 * Browser-safe: no Node imports.
 */
export function extractTunnelInfo(
  resourceValue: unknown,
  allTaskIds: string[],
  allEventIds: string[]
): TunnelInfo | null {
  if (!resourceValue || typeof resourceValue !== "object") return null;
  const val = resourceValue as Record<string, unknown>;

  // Check for tunnel-like properties
  const mode = val.mode;
  if (mode !== "client" && mode !== "server" && mode !== "both") return null;

  const transport = typeof val.transport === "string" ? val.transport : "http";

  // Resolve task IDs - can be an array or a predicate function
  let tasks: string[] | undefined;
  if (Array.isArray(val.tasks)) {
    tasks = val.tasks.map((t: unknown) =>
      typeof t === "string" ? t : readId(t)
    );
  } else if (typeof val.tasks === "function") {
    tasks = allTaskIds.filter((id) => {
      try {
        return (val.tasks as (task: { id: string }) => boolean)({ id });
      } catch {
        return false;
      }
    });
  }

  // Resolve event IDs - can be an array or a predicate function
  let events: string[] | undefined;
  if (Array.isArray(val.events)) {
    events = val.events.map((e: unknown) =>
      typeof e === "string" ? e : readId(e)
    );
  } else if (typeof val.events === "function") {
    events = allEventIds.filter((id) => {
      try {
        return (val.events as (event: { id: string }) => boolean)({ id });
      } catch {
        return false;
      }
    });
  }

  // Extract endpoint (for client tunnels)
  let endpoint: string | undefined;
  if (typeof val.endpoint === "string") {
    endpoint = val.endpoint;
  } else if (val.client && typeof val.client === "object") {
    endpoint = (val.client as Record<string, unknown>).baseUrl as string;
  }

  // Extract auth method
  let auth: string | undefined;
  if (typeof val.auth === "string") {
    auth = val.auth;
  } else if (val.auth && typeof val.auth === "object") {
    const authObj = val.auth as Record<string, unknown>;
    if (authObj.token) auth = "token";
    else if (authObj.validator) auth = "validator";
    else auth = "custom";
  }

  const eventDeliveryMode =
    typeof val.eventDeliveryMode === "string"
      ? val.eventDeliveryMode
      : undefined;

  return {
    mode: mode as "client" | "server" | "both",
    transport: transport as "http" | "other",
    tasks,
    events,
    endpoint,
    auth,
    eventDeliveryMode,
  };
}
