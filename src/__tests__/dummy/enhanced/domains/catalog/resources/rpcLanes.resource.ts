import { defineResource, type IResource, r } from "@bluelibs/runner";
import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import {
  rpcLanesResource,
  type RpcLanesResourceConfig,
} from "@bluelibs/runner/node";
import { catalogEventsCommunicatorResource } from "./catalogEventsCommunicator.resource";
import { catalogSyncCommunicatorResource } from "./catalogSyncCommunicator.resource";
import { pricingCommunicatorResource } from "./pricingCommunicator.resource";

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

export const rpcLanesShowcaseResource: ResourceWithMeta<
  typeof rpcLanesResource
> = defineResource({
  id: rpcLanesResource.id,
  tags: rpcLanesResource.tags,
  configSchema: rpcLanesResource.configSchema,
  resultSchema: rpcLanesResource.resultSchema,
  dependencies: rpcLanesResource.dependencies,
  context: rpcLanesResource.context,
  init: rpcLanesResource.init,
  middleware: rpcLanesResource.middleware,
  dispose: rpcLanesResource.dispose,
  ready: rpcLanesResource.ready,
  cooldown: rpcLanesResource.cooldown,
  health: rpcLanesResource.health,
  meta: {
    title: "RPC Lanes",
    description:
      "Hosts the reference app RPC topology for pricing and supplier sync.\n\n- Binds each lane to a transport resource\n- Makes remote execution paths visible without real network calls",
  },
});

const rpcLanesShowcaseConfig: RpcLanesResourceConfig = {
  mode: "network",
  profile: "commerce",
  topology: {
    bindings: [
      {
        lane: { id: "rpc-pricing-preview" },
        communicator: pricingCommunicatorResource,
      },
      {
        lane: { id: "rpc-catalog-sync" },
        communicator: catalogSyncCommunicatorResource,
      },
      {
        lane: { id: "rpc-catalog-updates" },
        communicator: catalogEventsCommunicatorResource,
      },
    ],
    profiles: {
      commerce: {
        serve: [
          { id: "rpc-pricing-preview" },
          { id: "rpc-catalog-sync" },
          { id: "rpc-catalog-updates" },
        ],
      },
    },
  },
};

export const rpcLanesShowcaseRegistration: RegisterableItems =
  rpcLanesShowcaseResource.with(rpcLanesShowcaseConfig);

export const rpcLanesShowcaseOverride: OverridableElements = r.override(
  rpcLanesShowcaseResource,
  (async (config) => ({
    profile: config.profile,
    mode: "network",
    serveTaskIds: [],
    serveEventIds: [],
    taskAllowAsyncContext: {},
    eventAllowAsyncContext: {},
    taskAsyncContextAllowList: {},
    eventAsyncContextAllowList: {},
    communicatorByLaneId: new Map(),
    exposure: null,
  })) satisfies NonNullable<typeof rpcLanesShowcaseResource.init>
);
