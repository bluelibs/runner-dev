import { run } from "@bluelibs/runner";
import { dev } from "../../resources/dev.resource";
import { createDummyApp } from "./dummyApp";

const app = createDummyApp([
  dev.with({
    port: 31338,
  }),
]);

run(app, {
  logs: {
    printThreshold: "warn",
  },
}).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
