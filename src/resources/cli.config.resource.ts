import { defineResource, type Store } from "@bluelibs/runner";

export interface CliConfigValue {
  store: Store;
}

export const cliConfig = defineResource({
  id: "runner-dev-resources-cli-config",
  meta: {
    title: "CLI Configuration",
    description:
      "Provides CLI-specific configuration including custom store for command-line operations",
  },
  async init(config: { customStore: Store }): Promise<CliConfigValue> {
    return { store: config.customStore };
  },
});
