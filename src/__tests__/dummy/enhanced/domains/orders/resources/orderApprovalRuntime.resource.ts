import type { IResource, IResourceWithConfig } from "@bluelibs/runner";
import { defineResource } from "@bluelibs/runner";
import {
  durableWorkflowTag,
  memoryDurableResource,
  type DurableResource,
} from "@bluelibs/runner/node";

export const showcaseDurableResource: IResource<
  any,
  Promise<DurableResource>,
  any,
  any,
  { title: string; description: string }
> = defineResource({
  id: "durable-runtime",
  tags: memoryDurableResource.tags,
  configSchema: memoryDurableResource.configSchema,
  resultSchema: memoryDurableResource.resultSchema,
  dependencies: memoryDurableResource.dependencies,
  context: memoryDurableResource.context,
  init: memoryDurableResource.init,
  middleware: memoryDurableResource.middleware,
  dispose: memoryDurableResource.dispose,
  ready: memoryDurableResource.ready,
  cooldown: memoryDurableResource.cooldown,
  health: memoryDurableResource.health,
  meta: {
    title: "Order Approval Runtime",
    description:
      "Hosts the durable execution state for order review and approval.\n\n- Uses the in-memory durable backend\n- Mirrors how a real workflow runtime would appear in topology",
  },
});

export const showcaseDurableRegistration: IResourceWithConfig<
  any,
  Promise<DurableResource>
> = showcaseDurableResource.with({});

export { durableWorkflowTag };
