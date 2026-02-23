import { RegisterableItems, r } from "@bluelibs/runner";
import { z } from "zod";

const interceptorInputSchema = z.object({
  value: z.number(),
});

const interceptorResultSchema = z.object({
  value: z.number(),
  intercepted: z.boolean(),
});

export const interceptorBaseTask = r
  .task("app.examples.interceptors.tasks.base")
  .meta({
    title: "Interceptor Base Task",
    description: "Task wrapped by a runtime interceptor during resource init.",
  })
  .inputSchema(interceptorInputSchema)
  .resultSchema(interceptorResultSchema)
  .run(async (input) => ({
    value: input.value,
    intercepted: false,
  }))
  .build();

export const interceptorInstallerResource = r
  .resource("app.examples.interceptors.resources.installer")
  .meta({
    title: "Interceptor Installer Resource",
    description:
      "Registers a runtime interceptor so introspection exposes owner ids and counts.",
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
  .task("app.examples.interceptors.tasks.consumer")
  .meta({
    title: "Interceptor Consumer Task",
    description:
      "Calls the intercepted task to show runtime interceptor behavior.",
  })
  .dependencies({ interceptorBaseTask })
  .resultSchema(interceptorResultSchema)
  .run(async (_input, { interceptorBaseTask }) =>
    interceptorBaseTask({ value: 1 })
  )
  .build();

export const interceptorShowcaseRegistrations: RegisterableItems[] = [
  interceptorBaseTask,
  interceptorInstallerResource,
  interceptorConsumerTask,
];
