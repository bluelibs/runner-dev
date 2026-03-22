import { r } from "@bluelibs/runner";
import { InterceptorResultSchema } from "../../../schemas";
import { interceptorBaseTask } from "./catalogInterceptorBase.task";

export const interceptorConsumerTask = r
  .task("catalog-handler-smoke-check")
  .meta({
    title: "Catalog Handler Smoke Check",
    description:
      "Calls the policy-managed handler through its normal task dependency.\n\n- Verifies interceptor ownership shows up in topology\n- Reads like a real operational probe instead of a toy demo",
  })
  .dependencies({ interceptorBaseTask })
  .resultSchema(InterceptorResultSchema)
  .run(async (_input, { interceptorBaseTask }) =>
    interceptorBaseTask({ value: 1 })
  )
  .build();
