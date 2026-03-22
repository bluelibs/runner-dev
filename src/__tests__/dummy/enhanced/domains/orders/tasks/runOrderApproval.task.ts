import { r } from "@bluelibs/runner";
import {
  DurableOrderApprovalInputSchema,
  DurableOrderApprovalResultSchema,
} from "../../../schemas";
import { showcaseDurableResource } from "../resources/orderApprovalRuntime.resource";
import { durableOrderApprovalTask } from "./orderApproval.task";

export const runDurableOrderApprovalTask = r
  .task("run-order-approval")
  .meta({
    title: "Run Order Approval Workflow",
    description:
      "Starts the order approval workflow and waits for completion.\n\n- Mirrors a synchronous API facade over durable execution\n- Keeps the entrypoint explicit in topology",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableOrderApprovalResultSchema)
  .run(async (input, { durable }) => {
    const result = await durable.startAndWait(durableOrderApprovalTask, input);
    return result.data;
  })
  .build();
