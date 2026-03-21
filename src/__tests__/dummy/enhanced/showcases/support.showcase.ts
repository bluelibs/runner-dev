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
    title: "Request Context Scope",
    description:
      "Carries request-scoped metadata across the platform support flow.\n\n- Exposes a stable `requestId` for downstream tasks\n- Useful for showing `provided-by`, `required-by`, and `used-by` edges in docs",
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
  .meta({
    title: "Request Context Middleware",
    description:
      "Provides `request-context` before the probe task runs.\n\n- Small cross-cutting example\n- Kept intentionally side-effect free",
  })
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
    title: "Invalid Input",
    description:
      "Typed support error used by the probe task.\n\n- Keeps the error surface visible in docs\n- Shows `thrown-by` relationships",
  })
  .build();

export const supportContextAndErrorProbeTask = r
  .task("context-and-error-probe")
  .meta({
    title: "Context Probe",
    description:
      "Reads the request context and can throw `invalid-input`.\n\n- Minimal task with context + error coverage\n- Useful for topology and docs cards",
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
