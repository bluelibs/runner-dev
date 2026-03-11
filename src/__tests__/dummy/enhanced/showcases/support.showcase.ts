import { RegisterableItems, r } from "@bluelibs/runner";
import {
  InvalidInputErrorData,
  InvalidInputErrorDataSchema,
  SupportProbeInputSchema,
  SupportProbeResultSchema,
} from "./schemas";

export const supportRequestContext = r
  .asyncContext<{ requestId: string }>("request-context")
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
  .task("request-context")
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
  .error<InvalidInputErrorData>("invalid-input")
  .dataSchema(InvalidInputErrorDataSchema)
  .httpCode(400)
  .meta({
    title: "Invalid Input Error",
    description: "Minimal custom error helper kept for Error card visibility.",
  })
  .build();

export const supportContextAndErrorProbeTask = r
  .task("context-and-error-probe")
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
  .inputSchema(SupportProbeInputSchema)
  .resultSchema(SupportProbeResultSchema)
  .run(async (input, { supportRequestContext, invalidInputError }) => {
    if (input.fail ?? false) {
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
