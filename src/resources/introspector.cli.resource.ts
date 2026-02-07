import { resource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";
import { cliConfig } from "./cli.config.resource";

export const introspectorCli = resource({
  id: "runner-dev.resources.introspector-cli",
  meta: {
    title: "CLI Application Introspector",
    description:
      "CLI version of the introspector that analyzes applications using a custom store for command-line operations",
  },
  dependencies: { cli: cliConfig },
  async init(_config, { cli }) {
    const i = new Introspector({ store: cli.store });
    initializeFromStore(i, cli.store);
    return i;
  },
});
