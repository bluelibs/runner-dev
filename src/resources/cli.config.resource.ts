import { resource, type Store } from "@bluelibs/runner";

export interface CliConfigValue {
  store: Store;
}

export const cliConfig = resource({
  id: "runner-dev.resources.cli-config",
  async init(config: { customStore: Store }): Promise<CliConfigValue> {
    return { store: config.customStore };
  },
});
