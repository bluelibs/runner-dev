import { RegisterableItems } from "@bluelibs/runner";
import { durableShowcaseRegistrations } from "./durable.showcase";
import { interceptorShowcaseRegistrations } from "./interceptors.showcase";
import { supportShowcaseRegistrations } from "./support.showcase";
import { tagsIsolationShowcaseRegistrations } from "./tagsIsolation.showcase";
import { tunnelShowcaseRegistrations } from "./tunnel.showcase";

export {
  featuredTag,
  publicCatalogResource,
  privateCacheResource,
  catalogSearchTask,
  featuredInspectorTask,
  isolationBoundaryResource,
  tagsIsolationShowcaseRegistrations,
} from "./tagsIsolation.showcase";

export {
  interceptorBaseTask,
  interceptorInstallerResource,
  interceptorConsumerTask,
  interceptorShowcaseRegistrations,
} from "./interceptors.showcase";

export {
  tunnelCatalogUpdatedEvent,
  tunnelPricingPreviewTask,
  tunnelCatalogSyncTask,
  tunnelServerShowcaseResource,
  tunnelShowcaseRegistrations,
} from "./tunnel.showcase";

export {
  showcaseDurableResource,
  showcaseDurableRegistration,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
  durableShowcaseRegistrations,
} from "./durable.showcase";

export {
  supportRequestContext,
  supportRequestContextMiddleware,
  invalidInputError,
  supportContextAndErrorProbeTask,
  supportShowcaseRegistrations,
} from "./support.showcase";

export type EnhancedShowcaseModule = {
  id: string;
  registrations: RegisterableItems[];
};

export const enhancedShowcaseModules: EnhancedShowcaseModule[] = [
  {
    id: "tags-isolation",
    registrations: tagsIsolationShowcaseRegistrations,
  },
  {
    id: "interceptors",
    registrations: interceptorShowcaseRegistrations,
  },
  {
    id: "tunnel",
    registrations: tunnelShowcaseRegistrations,
  },
  {
    id: "durable",
    registrations: durableShowcaseRegistrations,
  },
  {
    id: "support",
    registrations: supportShowcaseRegistrations,
  },
];

export const enhancedShowcaseRegistrations: RegisterableItems[] =
  enhancedShowcaseModules.flatMap((module) => module.registrations);
