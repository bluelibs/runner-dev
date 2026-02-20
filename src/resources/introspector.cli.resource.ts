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
    const i = new Introspector({
      store: cli.store,
      runtime: (cli as any).runtime,
      runOptions:
        process.env.RUNNER_DEV_DRY_RUN === "1"
          ? {
              mode: cli.store.mode ?? "dev",
              debug: !!cli.store.resources?.has?.("globals.resources.debug"),
              debugMode: cli.store.resources?.has?.("globals.resources.debug")
                ? "normal"
                : "disabled",
              logsEnabled: true,
              logsPrintThreshold: null,
              logsPrintStrategy: "pretty",
              logsBuffer: false,
              errorBoundary: null,
              shutdownHooks: null,
              dryRun: true,
              lazy: false,
              initMode: "sequential",
              runtimeEventCycleDetection: null,
              hasOnUnhandledError: true,
              rootId:
                cli.store.root?.resource?.id != null
                  ? String(cli.store.root.resource.id)
                  : "",
            }
          : null,
    });
    initializeFromStore(i, cli.store);
    return i;
  },
});
