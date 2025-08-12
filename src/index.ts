import { server } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/dev.telemetry.resource";

export const resources = {
  server,
  introspector,
  live,
  telemetry,
};
