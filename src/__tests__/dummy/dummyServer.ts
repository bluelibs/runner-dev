import { run } from "@bluelibs/runner";
import { createDummyApp } from "./dummyApp";
import { live } from "../../resources/live.resource";
import { introspector } from "../../resources/introspector.resource";
import { telemetry } from "../../resources/telemetry.resource";
import { serverResource } from "../../resources/server.resource";
import { graphql } from "../../resources/graphql-accumulator.resource";
import { swapManager } from "../../resources/swap.resource";
import { dev } from "../../resources/dev.resource";
import { createDummySuperApp } from "./dummySuperApp";

const app = createDummySuperApp([
  dev.with({
    port: 31337,
  }),
]);

run(app, {
  debug: "normal",
  logs: {
    printThreshold: "debug",
  },
})
  .then(() => {})
  .catch(console.error);
