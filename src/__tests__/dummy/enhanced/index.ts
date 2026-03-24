import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import { r } from "@bluelibs/runner";
import {
  catalogDomainOverrides,
  catalogDomainRegistrations,
  catalogProjectionHook,
  catalogProjectionResource,
  catalogSearchTask,
  eventLaneCatalogProjectionUpdatedEvent,
  eventLanesShowcaseResource,
  featuredInspectorTask,
  featuredTag,
  interceptorBaseTask,
  interceptorConsumerTask,
  interceptorInstallerResource,
  isolationBoundaryResource,
  privateCacheResource,
  publicCatalogResource,
  rpcLaneCatalogSyncTask,
  rpcLaneCatalogUpdatedEvent,
  rpcLanePricingPreviewTask,
  rpcLanesShowcaseResource,
} from "./domains/catalog";
import {
  ordersDomainRegistrations,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  showcaseDurableResource,
  startDurableOrderApprovalTask,
} from "./domains/orders";
import {
  platformDomainRegistrations,
  databaseResource,
  httpServerResource,
  httpTag,
  invalidInputError,
  mikroOrmResource,
  supportRequestContext,
  supportRequestContextMiddleware,
} from "./domains/platform";

export const ENHANCED_SUPERAPP_ID = "enhanced-superapp";

function createScopedIds(prefix: string) {
  return {
    resource(localId: string) {
      return `${prefix}.${localId}`;
    },
    task(localId: string) {
      return `${prefix}.tasks.${localId}`;
    },
    hook(localId: string) {
      return `${prefix}.hooks.${localId}`;
    },
    event(localId: string) {
      return `${prefix}.events.${localId}`;
    },
    tag(localId: string) {
      return `${prefix}.tags.${localId}`;
    },
    asyncContext(localId: string) {
      return `${prefix}.asyncContexts.${localId}`;
    },
    error(localId: string) {
      return `${prefix}.errors.${localId}`;
    },
    middleware(localId: string) {
      return `${prefix}.middleware.task.${localId}`;
    },
  };
}

export const enhancedSuperAppIds = {
  ...createScopedIds(ENHANCED_SUPERAPP_ID),
  platform: createScopedIds(`${ENHANCED_SUPERAPP_ID}.platform`),
  catalog: createScopedIds(`${ENHANCED_SUPERAPP_ID}.catalog`),
  orders: createScopedIds(`${ENHANCED_SUPERAPP_ID}.orders`),
  scopedResource(localId: string) {
    return createScopedIds(`${ENHANCED_SUPERAPP_ID}.${localId}`);
  },
};

export const enhancedDomainRegistrations: readonly RegisterableItems[] = [
  ...platformDomainRegistrations,
  ...catalogDomainRegistrations,
  ...ordersDomainRegistrations,
];

export const enhancedDomainOverrides: readonly OverridableElements[] = [
  ...catalogDomainOverrides,
];

export const createEnhancedSuperApp = (extra: RegisterableItems[] = []) => {
  return r
    .resource(ENHANCED_SUPERAPP_ID)
    .meta({
      title: "Reference Commerce Platform",
      description:
        "Realistic local reference app for Runner Dev docs and topology.\n\n- Composed from platform, catalog, and orders domains\n- Simulates HTTP, persistence, lanes, middleware, and durable workflows",
    })
    .register([...enhancedDomainRegistrations, ...extra])
    .overrides([...enhancedDomainOverrides])
    .init(async () => {
      return {};
    })
    .build();
};

export {
  httpTag,
  httpServerResource,
  databaseResource,
  mikroOrmResource,
  featuredTag,
  publicCatalogResource,
  privateCacheResource,
  catalogSearchTask,
  featuredInspectorTask,
  isolationBoundaryResource,
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
  showcaseDurableResource,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
  supportRequestContext,
  supportRequestContextMiddleware,
  invalidInputError,
};
