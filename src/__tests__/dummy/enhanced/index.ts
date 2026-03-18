import { RegisterableItems, r } from "@bluelibs/runner";
import {
  catalogDomainResource,
  enhancedDomainOverrides,
  enhancedDomainRegistrations,
  ENHANCED_DOMAIN_IDS,
  ordersDomainResource,
  platformDomainResource,
} from "./domains";
import {
  catalogProjectionHook,
  catalogProjectionResource,
  catalogSearchTask,
  catalogShowcaseOverrides,
  catalogShowcaseRegistrations,
  durableOrderApprovalTask,
  enhancedShowcaseModules,
  enhancedShowcaseOverrides,
  enhancedShowcaseRegistrations,
  eventLaneCatalogProjectionUpdatedEvent,
  eventLanesShowcaseRegistration,
  eventLanesShowcaseResource,
  featuredInspectorTask,
  featuredTag,
  interceptorBaseTask,
  interceptorConsumerTask,
  interceptorInstallerResource,
  invalidInputError,
  isolationBoundaryResource,
  ordersShowcaseRegistrations,
  platformShowcaseRegistrations,
  privateCacheResource,
  publicCatalogResource,
  rpcLaneCatalogUpdatedEvent,
  rpcLaneCatalogSyncTask,
  rpcLanePricingPreviewTask,
  rpcLanesShowcaseRegistration,
  rpcLanesShowcaseResource,
  runDurableOrderApprovalTask,
  showcaseDurableRegistration,
  showcaseDurableResource,
  startDurableOrderApprovalTask,
  supportContextAndErrorProbeTask,
  supportRequestContext,
  supportRequestContextMiddleware,
  type EnhancedShowcaseModule,
} from "./showcases";

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
  platform: createScopedIds(
    `${ENHANCED_SUPERAPP_ID}.${ENHANCED_DOMAIN_IDS.platform}`
  ),
  catalog: createScopedIds(
    `${ENHANCED_SUPERAPP_ID}.${ENHANCED_DOMAIN_IDS.catalog}`
  ),
  orders: createScopedIds(
    `${ENHANCED_SUPERAPP_ID}.${ENHANCED_DOMAIN_IDS.orders}`
  ),
  scopedResource(localId: string) {
    return createScopedIds(`${ENHANCED_SUPERAPP_ID}.${localId}`);
  },
};

export {
  ENHANCED_DOMAIN_IDS,
  platformDomainResource,
  catalogDomainResource,
  ordersDomainResource,
  enhancedDomainRegistrations,
  enhancedDomainOverrides,
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
  rpcLanesShowcaseRegistration,
  eventLanesShowcaseResource,
  eventLanesShowcaseRegistration,
  showcaseDurableResource,
  showcaseDurableRegistration,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
  supportRequestContext,
  supportRequestContextMiddleware,
  invalidInputError,
  supportContextAndErrorProbeTask,
  enhancedShowcaseModules,
  enhancedShowcaseOverrides,
  enhancedShowcaseRegistrations,
  catalogShowcaseRegistrations,
  catalogShowcaseOverrides,
  platformShowcaseRegistrations,
  ordersShowcaseRegistrations,
  type EnhancedShowcaseModule,
};

export const createEnhancedSuperApp = (extra: RegisterableItems[] = []) => {
  return r
    .resource("enhanced-superapp")
    .meta({
      title: "Play App",
      description:
        "Minimal Runner app skeleton for docs and topology.\n\n- Composed from platform, catalog, and orders\n- Exercises tags, isolation, interceptors, lanes, and durable flows",
    })
    .register([...enhancedDomainRegistrations, ...extra])
    .overrides(enhancedDomainOverrides)
    .init(async () => {
      console.log("[enhanced.play] Lean showcase app ready.");
      console.log(
        "[enhanced.play] Domains: platform, catalog, orders. Features: tags/handlers, isolation, interceptors, lanes, durable, support."
      );
      return {};
    })
    .build();
};
