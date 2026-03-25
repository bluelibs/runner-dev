import { defineResource, type IResource, r } from "@bluelibs/runner";
import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import {
  eventLanesResource,
  type EventLanesResourceConfig,
} from "@bluelibs/runner/node";
import { eventLaneCatalogProjectionUpdatedEvent } from "../events/catalogProjectionUpdated.event";
import { catalogUpdatesQueueResource } from "./catalogUpdatesQueue.resource";

type LaneResourceMeta = { title: string; description: string };

type ResourceWithMeta<TResource> = TResource extends IResource<
  infer TConfig,
  infer TValue,
  infer TDependencies,
  infer TContext,
  any,
  infer TTags,
  infer TMiddleware
>
  ? IResource<
      TConfig,
      TValue,
      TDependencies,
      TContext,
      LaneResourceMeta,
      TTags,
      TMiddleware
    >
  : never;

const catalogUpdatesEventLane = r
  .eventLane("event-catalog-updates")
  .applyTo([eventLaneCatalogProjectionUpdatedEvent])
  .build();

export const eventLanesShowcaseResource: ResourceWithMeta<
  typeof eventLanesResource
> = defineResource({
  id: eventLanesResource.id,
  tags: eventLanesResource.tags,
  configSchema: eventLanesResource.configSchema,
  resultSchema: eventLanesResource.resultSchema,
  dependencies: eventLanesResource.dependencies,
  context: eventLanesResource.context,
  init: eventLanesResource.init,
  middleware: eventLanesResource.middleware,
  dispose: eventLanesResource.dispose,
  ready: eventLanesResource.ready,
  cooldown: eventLanesResource.cooldown,
  health: eventLanesResource.health,
  meta: {
    title: "Event Lanes",
    description:
      "Hosts the reference app event-lane topology for catalog projections.\n\n- Connects the projection-updated event to a queue\n- Makes background event delivery visible in docs",
  },
});

const eventLanesShowcaseConfig: EventLanesResourceConfig = {
  mode: "network",
  profile: "commerce-events",
  topology: {
    relaySourcePrefix: "runner.event-lanes.relay:",
    bindings: [
      {
        lane: catalogUpdatesEventLane,
        queue: catalogUpdatesQueueResource,
        prefetch: 8,
      },
    ],
    profiles: {
      "commerce-events": {
        consume: [{ lane: catalogUpdatesEventLane }],
      },
    },
  },
};

export const eventLanesShowcaseRegistration: RegisterableItems =
  eventLanesShowcaseResource.with(eventLanesShowcaseConfig);

export const eventLanesShowcaseOverride: OverridableElements = r.override(
  eventLanesShowcaseResource,
  (async (config) => ({
    profile: config.profile,
    consumers: 0,
  })) satisfies NonNullable<typeof eventLanesShowcaseResource.init>
);
