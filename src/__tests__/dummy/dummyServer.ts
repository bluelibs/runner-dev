import { run } from "@bluelibs/runner";
import { createDummyApp } from "./dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/dev.telemetry.resource";
import { server } from "../../resources/server.resource";
import { graphql } from "../../resources/graphql-accumulator.resource";
import { swapManager } from "../../resources/swap.resource";

const app = createDummyApp([
  live,
  introspector,
  telemetry,
  server,
  graphql,
  swapManager,
]);

run(app).then(() => {
  console.log("Server started");
});
