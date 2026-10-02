import {
  isResource,
  isResourceWithConfig,
  type IResource,
  type IResourceWithConfig,
} from "@bluelibs/runner";
import z from "zod";
import type { RunRecord } from "./types";

export interface ApmRetention {
  maxSamples: number;
  maxStorage?: number;
  retentionDays?: number;
  cutoffTimestampMs?: number;
}
/** Async initialization and flush; append only enqueues, keeping instrumentation synchronous. */
export interface ApmPersistence {
  storage: string;
  load(
    options: ApmRetention
  ): Promise<{ samples: RunRecord[]; lastSequence: number }>;
  append(sample: RunRecord): undefined;
  flush(): Promise<void>;
  status?(): { pendingSamples: number; error: string | null };
}
export type ApmPersistenceResourceDefinition = Omit<
  IResource<any, any, any, any, any, any, any>,
  "init"
> & {
  init?: IResource<
    any,
    Promise<ApmPersistence>,
    any,
    any,
    any,
    any,
    any
  >["init"];
};
export type ApmPersistenceSource =
  | ApmPersistenceResourceDefinition
  | (Omit<
      IResourceWithConfig<any, any, any, any, any, any, any>,
      "resource"
    > & { resource: ApmPersistenceResourceDefinition });
export const apmPersistenceSourceSchema = z.custom<ApmPersistenceSource>(
  (value) => isResource(value) || isResourceWithConfig(value),
  "APM persistence must be a Runner resource"
);
export function apmPersistenceDefinition(source?: ApmPersistenceSource) {
  if (isResourceWithConfig(source)) return source.resource;
  if (isResource(source)) return source;
  return undefined;
}
export function validateApmPersistence(
  value: unknown
): asserts value is ApmPersistence {
  if (
    !value ||
    typeof value !== "object" ||
    !("storage" in value) ||
    typeof value.storage !== "string" ||
    !("load" in value) ||
    typeof value.load !== "function" ||
    !("append" in value) ||
    typeof value.append !== "function" ||
    !("flush" in value) ||
    typeof value.flush !== "function"
  )
    throw new Error("Invalid APM persistence provider.");
}

export function enqueueApmSample(
  provider: ApmPersistence,
  sample: RunRecord
): void {
  const result: unknown = provider.append(sample);
  if (result === undefined) return;
  if (
    result &&
    (typeof result === "object" || typeof result === "function") &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    void Promise.resolve(result).catch(() => {});
  }
  throw new Error(
    "APM append() must enqueue synchronously and return undefined; use flush() for asynchronous writes."
  );
}
