import { RegisterableItems, r } from "@bluelibs/runner";
import { InterceptorInputSchema, InterceptorResultSchema } from "./schemas";

export const interceptorBaseTask = r
  .task("interceptor-base")
  .meta({
    title: "Interceptor Base",
    description:
      "Base task used to expose runtime interceptor ownership.\n\n- Returns a small payload\n- Starts un-intercepted on purpose",
  })
  .inputSchema(InterceptorInputSchema)
  .resultSchema(InterceptorResultSchema)
  .run(async (input) => ({
    value: input.value,
    intercepted: false,
  }))
  .build();

export const interceptorInstallerResource = r
  .resource("interceptor-installer")
  .meta({
    title: "Interceptor Installer",
    description:
      "Attaches the runtime interceptor to the base task.\n\n- No business state\n- Exists so docs can show interceptor owner ids and counts",
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
    return {};
  })
  .build();

export const interceptorConsumerTask = r
  .task("interceptor-consumer")
  .meta({
    title: "Interceptor Consumer",
    description:
      "Calls the intercepted base task.\n\n- Tiny dependent task\n- Helps blast radius show task-to-task wiring",
  })
  .dependencies({ interceptorBaseTask })
  .resultSchema(InterceptorResultSchema)
  .run(async (_input, { interceptorBaseTask }) =>
    interceptorBaseTask({ value: 1 })
  )
  .build();

export const interceptorShowcaseRegistrations: RegisterableItems[] = [
  interceptorBaseTask,
  interceptorInstallerResource,
  interceptorConsumerTask,
];
