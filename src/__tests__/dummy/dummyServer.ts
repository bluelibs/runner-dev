import { run } from "@bluelibs/runner";
import { createDummyApp } from "./dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { serverResource } from "../../resources/server.resource";
import { graphql } from "../../resources/graphql-accumulator.resource";
import { swapManager } from "../../resources/swap.resource";
import { dev } from "../../resources/dev.resource";

const app = createDummyApp([
  dev.with({
    port: 31337,
  }),
  // live,
  // introspector,
  // telemetry,
  // server,
  // graphql,
  // swapManager,
]);

run(app, {
  logs: {
    printThreshold: "debug",
  },
})
  .then(() => {})
  .catch(console.error);
