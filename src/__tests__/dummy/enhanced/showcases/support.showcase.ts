import { RegisterableItems, r } from "@bluelibs/runner";
import { z } from "zod";

const supportProbeInputSchema = z.object({
  fail: z.boolean().optional().default(false),
  requestId: z.string().optional(),
});

const supportProbeResultSchema = z.object({
  ok: z.boolean(),
  requestId: z.string(),
});

const invalidInputErrorDataSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const supportRequestContext = r
  .asyncContext<{ requestId: string }>("app.examples.contexts.request")
  .meta({
    title: "Support Request Context",
    description:
      "Minimal async context kept in play so the async context section stays visible.",
  })
  .parse((raw) => JSON.parse(raw) as { requestId: string })
  .serialize((data) => JSON.stringify(data))
  .build();

function readRequestIdFromInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const candidate = Reflect.get(input, "requestId");
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  return candidate;
}

export const supportRequestContextMiddleware = r.middleware
  .task("app.examples.middleware.requestContext")
  .dependencies({ supportRequestContext })
  .run(async ({ task, next }, { supportRequestContext }) => {
    const requestId =
      readRequestIdFromInput(task.input) || `req-${Date.now().toString(36)}`;
    return supportRequestContext.provide({ requestId }, async () =>
      next(task.input)
    );
  })
  .build();

export const invalidInputError = r
  .error<z.infer<typeof invalidInputErrorDataSchema>>(
    "app.examples.errors.invalidInput"
  )
  .dataSchema(invalidInputErrorDataSchema)
  .httpCode(400)
  .meta({
    title: "Invalid Input Error",
    description: "Minimal custom error helper kept for Error card visibility.",
  })
  .build();

export const supportContextAndErrorProbeTask = r
  .task("app.examples.support.tasks.contextAndErrorProbe")
  .meta({
    title: "Context and Error Probe Task",
    description:
      "Small task that reads async context and can throw the support error.",
  })
  .dependencies({
    supportRequestContext,
    invalidInputError,
  })
  .middleware([supportRequestContextMiddleware])
  .inputSchema(supportProbeInputSchema)
  .resultSchema(supportProbeResultSchema)
  .run(async (input, { supportRequestContext, invalidInputError }) => {
    if (input.fail) {
      invalidInputError.throw({
        field: "fail",
        message: "Forced failure for support showcase.",
      });
    }

    const context = supportRequestContext.use();
    return {
      ok: true,
      requestId: context.requestId,
    };
  })
  .build();

export const supportShowcaseRegistrations: RegisterableItems[] = [
  supportRequestContext,
  supportRequestContextMiddleware,
  invalidInputError,
  supportContextAndErrorProbeTask,
];
