import type { RegisterableItems } from "@bluelibs/runner";
import { r } from "@bluelibs/runner";
import { supportRequestContext } from "./asyncContexts/httpRequestContext.asyncContext";
import { invalidInputError } from "./errors/httpBadRequest.error";
import { supportRequestContextMiddleware } from "./middleware/httpRequestContext.taskMiddleware";
import { databaseResource } from "./resources/database.resource";
import { httpServerResource } from "./resources/httpServer.resource";
import { mikroOrmResource } from "./resources/mikroOrm.resource";
import { platformHealthResource } from "./resources/platformHealth.resource";
import { httpTag } from "./tags/http.tag";

export const platformDomainResource = r
  .resource("platform")
  .meta({
    title: "Platform",
    description:
      "Operational infrastructure for the reference app.\n\n- HTTP edge and request context\n- Database, ORM, and health surfaces",
  })
  .register([
    httpTag,
    supportRequestContext,
    supportRequestContextMiddleware,
    invalidInputError,
    httpServerResource.with({ port: 31337, host: "localhost" }),
    databaseResource.with({
      client: "postgresql",
      database: "runner_reference",
      poolMin: 2,
      poolMax: 10,
    }),
    mikroOrmResource.with({
      contextName: "reference-app",
      debug: false,
    }),
    platformHealthResource,
  ])
  .build();

export const platformDomainRegistrations: RegisterableItems[] = [
  platformDomainResource,
];

export {
  httpTag,
  supportRequestContext,
  supportRequestContextMiddleware,
  invalidInputError,
  httpServerResource,
  databaseResource,
  mikroOrmResource,
  platformHealthResource,
};
