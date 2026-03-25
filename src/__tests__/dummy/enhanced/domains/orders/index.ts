import type { RegisterableItems } from "@bluelibs/runner";
import { r } from "@bluelibs/runner";
import { orderRepositoryResource } from "./resources/orderRepository.resource";
import {
  durableWorkflowTag,
  showcaseDurableRegistration,
  showcaseDurableResource,
} from "./resources/orderApprovalRuntime.resource";
import { durableOrderApprovalTask } from "./tasks/orderApproval.task";
import { runDurableOrderApprovalTask } from "./tasks/runOrderApproval.task";
import { startDurableOrderApprovalTask } from "./tasks/startOrderApproval.task";

export const ordersDomainResource = r
  .resource("orders")
  .meta({
    title: "Orders",
    description:
      "Order review and approval flows for the reference app.\n\n- Repository-backed order state\n- Durable approval workflow with sync and async entrypoints",
  })
  .register([
    durableWorkflowTag,
    orderRepositoryResource.with({ entityName: "OrderRecord" }),
    showcaseDurableRegistration,
    durableOrderApprovalTask,
    runDurableOrderApprovalTask,
    startDurableOrderApprovalTask,
  ])
  .build();

export const ordersDomainRegistrations: RegisterableItems[] = [
  ordersDomainResource,
];

export {
  showcaseDurableResource,
  durableOrderApprovalTask,
  runDurableOrderApprovalTask,
  startDurableOrderApprovalTask,
};
