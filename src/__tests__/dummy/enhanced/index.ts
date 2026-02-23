import { RegisterableItems, r } from "@bluelibs/runner";
import { enhancedShowcaseRegistrations } from "./showcases";

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
  tunnelCatalogUpdatedEvent,
  tunnelPricingPreviewTask,
  tunnelCatalogSyncTask,
  tunnelServerShowcaseResource,
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
  enhancedShowcaseRegistrations,
  type EnhancedShowcaseModule,
} from "./showcases";

export const createEnhancedSuperApp = (extra: RegisterableItems[] = []) => {
  return r
    .resource("enhanced.superapp")
    .meta({
      title: "Enhanced Play Showcase App",
      description:
        "Lean Runner-Dev showcase app focused on tags, isolation, interceptors, tunnel metadata, durable flows, and support primitives.",
    })
    .register([...enhancedShowcaseRegistrations, ...extra])
    .init(async () => {
      console.log("[enhanced.play] Lean showcase app ready.");
      console.log(
        "[enhanced.play] Features: tags/handlers, isolation wildcard rules, interceptors, tunnel, durable, support."
      );
      return {};
    })
    .build();
};
