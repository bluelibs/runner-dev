import { r } from "@bluelibs/runner";
import { interceptorBaseTask } from "../tasks/catalogInterceptorBase.task";

export const interceptorInstallerResource = r
  .resource("catalog-request-policies")
  .meta({
    title: "Catalog Request Policies",
    description:
      "Installs cross-cutting request policies on the catalog HTTP handler.\n\n- Owns the runtime interceptor\n- Makes policy ownership visible in docs and blast radius views",
  })
  .dependencies({ interceptorBaseTask })
  .init(async (_config, { interceptorBaseTask }) => {
    interceptorBaseTask.intercept(async (next, input) => {
      const result = await next({
        value: input.value + 1,
      });

      return {
        ...result,
        intercepted: true,
      };
    });

    return {
      installed: ["request-normalization"],
    };
  })
  .build();
