import { run } from "@bluelibs/runner";
import { graphqlCli } from "../resources/graphql.cli.resource";
import { loadEntryExport } from "./entryLoader";

export type CliHarness = Awaited<ReturnType<typeof run>>;

/**
 * Build a CLI GraphQL harness from a TS/JS entry file in one step.
 * - Loads the entry export
 * - Runs the entry in dry-run mode to obtain the Store
 * - Runs the CLI GraphQL harness with that Store
 */
export async function createGraphqlCliHarnessFromEntry(
  entryFile: string,
  exportName?: string
): Promise<CliHarness> {
  const entry = await loadEntryExport(entryFile, exportName);
  const dry = await run(entry, {
    dryRun: true,
    logs: { printThreshold: null },
  });
  const customStore = (dry as any)?.store;
  if (!customStore) {
    throw new Error("Dry-run did not return a store.");
  }
  const harness = await run(graphqlCli.with({ customStore }), {
    logs: { printThreshold: null },
  });
  return harness;
}
