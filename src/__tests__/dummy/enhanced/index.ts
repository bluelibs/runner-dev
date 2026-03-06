import { RegisterableItems, r } from "@bluelibs/runner";
import {
  enhancedShowcaseRegistrations,
  enhancedShowcaseOverrides,
} from "./showcases";

export const ENHANCED_SUPERAPP_ID = "enhanced-superapp";

export const enhancedSuperAppIds = {
  resource(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.${localId}`;
  },
  task(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.tasks.${localId}`;
  },
  hook(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.hooks.${localId}`;
  },
  event(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.events.${localId}`;
  },
  tag(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.tags.${localId}`;
  },
  asyncContext(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.ctx.${localId}`;
  },
  error(localId: string) {
    return `${ENHANCED_SUPERAPP_ID}.errors.${localId}`;
  },
};

export {
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
  type EnhancedShowcaseModule,
} from "./showcases";

export const createEnhancedSuperApp = (extra: RegisterableItems[] = []) => {
  return r
    .resource("enhanced-superapp")
    .meta({
      title: "Enhanced Play Showcase App",
      description:
        "Lean Runner-Dev showcase app focused on tags, isolation, interceptors, lane metadata, durable flows, and support primitives.",
    })
    .register([...enhancedShowcaseRegistrations, ...extra])
    .overrides(enhancedShowcaseOverrides)
    .init(async () => {
      console.log("[enhanced.play] Lean showcase app ready.");
      console.log(
        "[enhanced.play] Features: tags/handlers, isolation wildcard rules, interceptors, lanes, durable, support."
      );
      return {};
    })
    .build();
};
