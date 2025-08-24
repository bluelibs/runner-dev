import { resource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";
import { cliConfig } from "./cli.config.resource";

export const introspectorCli = resource({
  id: "runner-dev.resources.introspector-cli",
  dependencies: { cli: cliConfig },
  async init(_config, { cli }) {
    const i = new Introspector({ store: cli.store });
    initializeFromStore(i, cli.store);
    return i;
  },
});

