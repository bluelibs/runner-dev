import { r } from "@bluelibs/runner";
import {
  InterceptorInputSchema,
  InterceptorResultSchema,
} from "../../../schemas";

export const interceptorBaseTask = r
  .task("catalog-http-handler")
  .meta({
    title: "Catalog HTTP Handler",
    description:
      "Low-level handler that makes interceptor ownership visible.\n\n- Returns a tiny payload for docs and tests\n- Starts without policy applied until the installer resource wires it",
  })
  .inputSchema(InterceptorInputSchema)
  .resultSchema(InterceptorResultSchema)
  .run(async (input) => ({
    value: input.value,
    intercepted: false,
  }))
  .build();
