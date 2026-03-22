import { r } from "@bluelibs/runner";
import {
  DurableExecutionIdResultSchema,
  DurableOrderApprovalInputSchema,
} from "../../../schemas";
import { showcaseDurableResource } from "../resources/orderApprovalRuntime.resource";
import { durableOrderApprovalTask } from "./orderApproval.task";

export const startDurableOrderApprovalTask = r
  .task("start-order-approval")
  .meta({
    title: "Start Order Approval Workflow",
    description:
      "Starts the durable workflow and returns only the execution id.\n\n- Mirrors an async API entrypoint\n- Gives docs an alternate route into the same workflow",
  })
  .dependencies({
    durable: showcaseDurableResource,
    durableOrderApprovalTask,
  })
  .inputSchema(DurableOrderApprovalInputSchema)
  .resultSchema(DurableExecutionIdResultSchema)
  .run(async (input, { durable }) => {
    const executionId = await durable.start(durableOrderApprovalTask, input);
    return { executionId };
  })
  .build();
