import {
  durableEventBridgeResource,
  durableWorkflowTag,
} from "@bluelibs/runner/node";
import z from "zod";
import type { DashboardRuntime } from "./runtime";
import type { DurableCatalogEntry } from "./shared/catalog";

const routeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  key: z.string(),
});

function eventCatalog(runtime: DashboardRuntime): DurableCatalogEntry[] {
  const entries: DurableCatalogEntry[] = [];
  for (const resource of runtime.store.resources.values()) {
    if (
      !durableEventBridgeResource ||
      resource.resource.init !== durableEventBridgeResource.init
    )
      continue;
    // Runner 6 exposes no public route iterator. Read the finalized table so opening
    // Studio cannot re-run an application's applyTo predicate or change routing.
    const bridge: unknown = resource.value;
    if (
      !bridge ||
      typeof bridge !== "object" ||
      !("routes" in bridge) ||
      !(bridge.routes instanceof Map)
    )
      throw new Error(
        "This Runner event bridge does not expose its initialized routes."
      );
    for (const record of bridge.routes.values()) {
      const route = routeSchema.parse(record);
      if (runtime.store.resources.get(route.id)?.value !== runtime.durable)
        continue;
      const event = runtime.store.events.get(route.eventId)?.event;
      if (!event)
        throw new Error(`Missing registered durable event '${route.eventId}'.`);
      entries.push({
        kind: "Durable event",
        key: route.key,
        title: event.meta?.title ?? event.id,
        description: event.meta?.description ?? "",
        category: "Durable event",
      });
    }
  }
  return entries;
}

export function durableCatalog(
  runtime: DashboardRuntime
): DurableCatalogEntry[] {
  const entries = eventCatalog(runtime);
  for (const [key, latest] of runtime.workflows) {
    for (const { task, version } of runtime.workflowVersions?.get(key) ?? [
      { task: latest, version: undefined },
    ]) {
      entries.push({
        kind: "Workflow",
        key,
        version,
        title: task.meta?.title ?? key,
        description: task.meta?.description ?? "",
        category:
          durableWorkflowTag.extract(task.tags ?? [])?.category ?? "Workflow",
      });
    }
  }
  return entries.sort(
    (a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key)
  );
}
