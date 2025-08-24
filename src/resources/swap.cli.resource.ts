import { resource } from "@bluelibs/runner";
import type { ISwapManager } from "./swap.resource";
import { cliConfig } from "./cli.config.resource";
import { introspectorCli } from "./introspector.cli.resource";

// Minimal CLI-specific swap manager that uses the CLI store.
// Provides read-only visibility for GraphQL queries (empty by default).
export const swapManagerCli = resource({
  id: "runner-dev.resources.swap-manager-cli",
  dependencies: { cli: cliConfig, introspector: introspectorCli },
  async init(_cfg, { cli }): Promise<ISwapManager> {
    const api: ISwapManager = {
      async swap(taskId: string) {
        return { success: false, error: "Swap unavailable in CLI", taskId };
      },
      async unswap(taskId: string) {
        return { success: false, error: "Unswap unavailable in CLI", taskId };
      },
      async unswapAll() {
        return [];
      },
      getSwappedTasks() {
        return [];
      },
      isSwapped() {
        return false;
      },
      async invokeTask(taskId: string) {
        return {
          success: false,
          error: `invokeTask unavailable in CLI for ${taskId}`,
          taskId,
        };
      },
      async invokeEvent(eventId: string) {
        return {
          success: false,
          error: `invokeEvent unavailable in CLI for ${eventId}`,
        } as any;
      },
      async runnerEval() {
        return {
          success: false,
          error: "runnerEval unavailable in CLI",
        } as any;
      },
    };
    // Note: cli.store is available if needed for future enhancements
    void cli;
    return api;
  },
});
