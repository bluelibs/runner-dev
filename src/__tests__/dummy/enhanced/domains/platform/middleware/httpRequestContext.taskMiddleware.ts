import { r } from "@bluelibs/runner";
import { supportRequestContext } from "../asyncContexts/httpRequestContext.asyncContext";

function readStringField(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const candidate = Reflect.get(input, key);
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  return candidate.trim();
}

function readHttpMethod(input: unknown): "GET" | "POST" | "PATCH" {
  const method = readStringField(input, "method")?.toUpperCase();

  if (method === "POST" || method === "PATCH") {
    return method;
  }

  return "GET";
}

export const supportRequestContextMiddleware = r.middleware
  .task("http-request-context")
  .meta({
    title: "HTTP Request Context Middleware",
    description:
      "Provides request context before HTTP-oriented tasks run.\n\n- Generates a stable request id\n- Simulates auth/session propagation without real transport code",
  })
  .dependencies({ supportRequestContext })
  .run(async ({ task, next }, { supportRequestContext }) => {
    const method = readHttpMethod(task.input);
    const path = readStringField(task.input, "path") ?? "/internal/reference";
    const requestId =
      readStringField(task.input, "requestId") ||
      `req-${Date.now().toString(36)}`;
    const actorId = readStringField(task.input, "actorId") ?? "ops-demo-user";

    return supportRequestContext.provide(
      {
        requestId,
        method,
        path,
        actorId,
      },
      async () => next(task.input)
    );
  })
  .build();
