import z from "zod";
import type {
  LivePersistedEntry,
  LivePersistenceSnapshot,
} from "./persistence";

const stamp = {
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  timestampMs: z.number().finite(),
  correlationId: z.string().nullish(),
};

const persistedEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("log"),
    entry: z.object({
      ...stamp,
      level: z.enum([
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "critical",
        "fatal",
        "log",
      ]),
      message: z.string(),
      sourceId: z.string().nullish(),
      data: z.unknown().optional(),
    }),
  }),
  z.object({
    kind: z.literal("emission"),
    entry: z.object({
      ...stamp,
      eventId: z.string(),
      emitterId: z.string().nullish(),
      payload: z.unknown().optional(),
    }),
  }),
  z.object({
    kind: z.literal("error"),
    entry: z.object({
      ...stamp,
      sourceId: z.string(),
      sourceKind: z.enum([
        "TASK",
        "HOOK",
        "RESOURCE",
        "MIDDLEWARE",
        "INTERNAL",
      ]),
      message: z.string(),
      stack: z.string().nullish(),
      data: z.unknown().optional(),
    }),
  }),
  z.object({
    kind: z.literal("run"),
    entry: z.object({
      ...stamp,
      nodeId: z.string(),
      nodeKind: z.enum(["TASK", "HOOK"]),
      durationMs: z.number().finite(),
      ok: z.boolean(),
      error: z.string().nullish(),
      parentId: z.string().nullish(),
      rootId: z.string().nullish(),
    }),
  }),
]);

export function parsePersistedEntry(value: unknown): LivePersistedEntry {
  return persistedEntrySchema.parse(value);
}

export function validatePersistenceSnapshot(
  snapshot: LivePersistenceSnapshot
): void {
  z.number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .parse(snapshot.lastSequence);
  let previous = 0;
  for (const record of snapshot.entries) {
    parsePersistedEntry(record);
    if (
      record.entry.sequence <= previous ||
      record.entry.sequence > snapshot.lastSequence
    ) {
      throw new Error(
        "Live persistence entries must be ordered, unique and at or below lastSequence."
      );
    }
    previous = record.entry.sequence;
  }
}
