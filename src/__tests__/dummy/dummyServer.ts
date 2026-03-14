import { run } from "@bluelibs/runner";
import { dev } from "../../resources/dev.resource";
import { createEnhancedSuperApp } from "./enhanced";

const app = createEnhancedSuperApp([
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
