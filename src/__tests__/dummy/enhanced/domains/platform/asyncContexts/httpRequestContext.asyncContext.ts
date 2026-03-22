import { r } from "@bluelibs/runner";

export type HttpRequestContextValue = {
  requestId: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  actorId?: string;
};

export const supportRequestContext = r
  .asyncContext<HttpRequestContextValue>("request-context")
  .meta({
    title: "HTTP Request Context",
    description:
      "Carries request-scoped metadata through the reference app.\n\n- Includes method, path, and request id\n- Lets downstream tasks read the active actor",
  })
  .parse((raw) => JSON.parse(raw) as HttpRequestContextValue)
  .serialize((data) => JSON.stringify(data))
  .build();
