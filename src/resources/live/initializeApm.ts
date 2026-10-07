import { apmConfigSchema, createApm, type ApmConfig } from "./apm";
import { resolveApmRetention } from "./apmRetention";
import { sqliteApmPersistence } from "./sqliteApmPersistence";
import { validateApmPersistence } from "./apmPersistence";

/** Await persistence restoration before instrumentation can allocate sequences. */
export async function initializeApm(config?: ApmConfig, remote?: unknown) {
  const parsed = config === undefined ? false : apmConfigSchema.parse(config);
  const options = typeof parsed === "object" ? parsed : undefined;
  if (!parsed || options?.storage === "memory") return createApm(config);
  if (options?.persistence) {
    validateApmPersistence(remote);
    const snapshot = await remote.load(resolveApmRetention(config));
    return createApm(config, remote, snapshot);
  }
  let persistence: ReturnType<typeof sqliteApmPersistence> | undefined;
  try {
    persistence = sqliteApmPersistence(
      options?.sqliteFile ?? "./.runner-dev/apm.sqlite"
    );
    const snapshot = await persistence.load(resolveApmRetention(config));
    const restored = persistence;
    return createApm(config, restored, snapshot, () => restored.close());
  } catch (error) {
    if (persistence) await persistence.close().catch(() => {});
    if (
      !(error instanceof Error) ||
      !(error.cause instanceof Error) ||
      !("code" in error.cause) ||
      error.cause.code !== "ERR_UNKNOWN_BUILTIN_MODULE"
    )
      throw error;
    return createApm({ ...options, storage: "memory" });
  }
}
