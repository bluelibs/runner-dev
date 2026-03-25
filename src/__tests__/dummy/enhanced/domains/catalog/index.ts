import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import { r } from "@bluelibs/runner";
import { eventLaneCatalogProjectionUpdatedEvent } from "./events/catalogProjectionUpdated.event";
import { rpcLaneCatalogUpdatedEvent } from "./events/catalogUpdated.event";
import { catalogProjectionHook } from "./hooks/catalogProjectionSync.hook";
import { isolationBoundaryResource } from "./resources/catalogBoundary.resource";
import { catalogEventsCommunicatorResource } from "./resources/catalogEventsCommunicator.resource";
import { catalogProjectionResource } from "./resources/catalogProjection.resource";
import { catalogReadRepositoryResource } from "./resources/catalogReadRepository.resource";
import { catalogSyncCommunicatorResource } from "./resources/catalogSyncCommunicator.resource";
import { catalogUpdatesQueueResource } from "./resources/catalogUpdatesQueue.resource";
import {
  eventLanesShowcaseOverride,
  eventLanesShowcaseRegistration,
  eventLanesShowcaseResource,
} from "./resources/eventLanes.resource";
import { interceptorInstallerResource } from "./resources/catalogRequestPolicies.resource";
import { privateCacheResource } from "./resources/catalogPrivateCache.resource";
import { publicCatalogResource } from "./resources/catalogPublicReadModel.resource";
import { pricingCommunicatorResource } from "./resources/pricingCommunicator.resource";
import {
  rpcLanesShowcaseOverride,
  rpcLanesShowcaseRegistration,
  rpcLanesShowcaseResource,
} from "./resources/rpcLanes.resource";
import { featuredTag } from "./tags/featured.tag";
import { featuredInspectorTask } from "./tasks/inspectFeaturedCatalog.task";
import { interceptorConsumerTask } from "./tasks/catalogInterceptorConsumer.task";
import { interceptorBaseTask } from "./tasks/catalogInterceptorBase.task";
import { rpcLaneCatalogSyncTask } from "./tasks/catalogSync.task";
import { rpcLanePricingPreviewTask } from "./tasks/pricingPreview.task";
import { catalogSearchTask } from "./tasks/searchCatalog.task";

export const catalogDomainResource = r
  .resource("catalog")
  .meta({
    title: "Catalog",
    description:
      "Catalog-facing request and projection flows for the reference app.\n\n- Public search surface and isolation boundary\n- Sync lanes, projection hooks, and policy-managed handlers",
  })
  .register([
    featuredTag,
    catalogReadRepositoryResource.with({ entityName: "CatalogListing" }),
    isolationBoundaryResource,
    featuredInspectorTask,
    interceptorBaseTask,
    interceptorInstallerResource,
    interceptorConsumerTask,
    pricingCommunicatorResource,
    catalogSyncCommunicatorResource,
    catalogEventsCommunicatorResource,
    catalogUpdatesQueueResource,
    rpcLaneCatalogUpdatedEvent,
    eventLaneCatalogProjectionUpdatedEvent,
    catalogProjectionResource,
    catalogProjectionHook,
    rpcLanePricingPreviewTask,
    rpcLaneCatalogSyncTask,
    rpcLanesShowcaseRegistration,
    eventLanesShowcaseRegistration,
  ])
  .build();

export const catalogDomainRegistrations: RegisterableItems[] = [
  catalogDomainResource,
];

export const catalogDomainOverrides: OverridableElements[] = [
  rpcLanesShowcaseOverride,
  eventLanesShowcaseOverride,
];

export {
  isolationBoundaryResource,
  publicCatalogResource,
  privateCacheResource,
  featuredTag,
  catalogSearchTask,
  featuredInspectorTask,
  interceptorBaseTask,
  interceptorInstallerResource,
  interceptorConsumerTask,
  rpcLaneCatalogUpdatedEvent,
  eventLaneCatalogProjectionUpdatedEvent,
  catalogProjectionResource,
  catalogProjectionHook,
  rpcLanePricingPreviewTask,
  rpcLaneCatalogSyncTask,
  rpcLanesShowcaseResource,
  eventLanesShowcaseResource,
};
