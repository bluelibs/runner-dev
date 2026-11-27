import z from "zod";
import { bufferedPersistenceWriter } from "../bufferedPersistenceWriter";
import type { LivePersistence, LivePersistedEntry } from "../persistence";
import {
  parsePersistedEntry,
  validatePersistenceSnapshot,
} from "../persistence.schema";
import { telemetryJson } from "../telemetryJson";

export interface StoredSlot {
  slot: string;
  record: string;
}
export interface SlotDatabase {
  read(): Promise<StoredSlot[]>;
  commit(changes: StoredSlot[], revision: number): Promise<void>;
  close(): Promise<void>;
}
const kinds = ["log", "error", "emission", "run"] as const;
const metaSchema = z.object({
  lastSequence: z.number().int().nonnegative().safe(),
  revision: z.number().int().positive().safe(),
});

/** Each category owns a ring of database slots. Overwriting a slot evicts and commits atomically. */
export function remoteHistory(database: SlotDatabase) {
  const positions = { log: 0, error: 0, emission: 0, run: 0 };
  let capacity: number | undefined;
  let lastSequence = 0;
  let revision = 0;
  const commit = async (changes: StoredSlot[], sequence: number) => {
    const next = revision + 1;
    await database.commit(
      [
        ...changes,
        {
          slot: "meta",
          record: JSON.stringify({ lastSequence: sequence, revision: next }),
        },
      ],
      next
    );
    revision = next;
  };
  const writer = bufferedPersistenceWriter<{
    slot: string;
    record: string;
    sequence: number;
  }>(async (batch) => {
    // Multiple laps in a single batch need only the final value of each slot.
    const changed = new Map<string, StoredSlot>();
    for (const item of batch)
      if (item.slot)
        changed.set(item.slot, { slot: item.slot, record: item.record });
    await commit([...changed.values()], batch[batch.length - 1].sequence);
  });
  let loading = false;
  const store: LivePersistence & {
    flush(): Promise<void>;
    close(): Promise<void>;
  } = {
    async load({ maxEntries }) {
      z.number().int().nonnegative().safe().parse(maxEntries);
      writer.assertReady();
      if (loading)
        throw new Error("History restoration is already in progress.");
      loading = true;
      capacity = undefined;
      try {
        await writer.flush();
        const rows = await database.read();
        const meta = rows.find((row) => row.slot === "meta");
        const state = meta
          ? metaSchema.parse(JSON.parse(meta.record))
          : { lastSequence: 0, revision: 0 };
        const records = rows
          .filter((row) => row.slot !== "meta")
          .map((row) => {
            const value = parsePersistedEntry(JSON.parse(row.record));
            if (
              !new RegExp("^" + value.kind + ":(0|[1-9]\\d*)$").test(row.slot)
            )
              throw new Error("Invalid live history slot.");
            return { ...row, value };
          })
          .sort((a, b) => a.value.entry.sequence - b.value.entry.sequence);
        validatePersistenceSnapshot({
          lastSequence: state.lastSequence,
          entries: records.map((row) => row.value),
        });
        revision = state.revision;
        lastSequence = state.lastSequence;
        const changes = new Map<string, string>();
        const entries: LivePersistedEntry[] = [];
        for (const kind of kinds) {
          const all = records.filter((row) => row.value.kind === kind);
          const retained = all.slice(Math.max(0, all.length - maxEntries));
          const firstSlot = Number(retained[0]?.slot.split(":")[1] ?? 0);
          const aligned =
            retained.every(
              (row, i) =>
                row.slot === kind + ":" + ((firstSlot + i) % maxEntries)
            ) &&
            (retained.length === maxEntries || firstSlot === 0);
          // Changing the cap can change the wrap point. Repack only misaligned rings.
          for (const row of all.slice(0, all.length - retained.length))
            changes.set(row.slot, "");
          if (!aligned) {
            for (const row of retained) changes.set(row.slot, "");
            retained.forEach((row, i) =>
              changes.set(kind + ":" + i, row.record)
            );
          }
          positions[kind] = maxEntries
            ? ((aligned ? firstSlot : 0) + retained.length) % maxEntries
            : 0;
          for (const row of retained) entries.push(row.value);
        }
        if (changes.size)
          await commit(
            Array.from(changes, ([slot, record]) => ({ slot, record })),
            lastSequence
          );
        capacity = maxEntries;
        return {
          entries: entries.sort((a, b) => a.entry.sequence - b.entry.sequence),
          lastSequence,
        };
      } finally {
        loading = false;
      }
    },
    append(record, { maxEntries }) {
      writer.assertReady();
      if (maxEntries !== capacity || loading)
        throw new Error(
          "Load live history with this capacity before recording."
        );
      const raw = telemetryJson(record);
      const value = parsePersistedEntry(JSON.parse(raw));
      const sequence = value.entry.sequence;
      if (sequence <= lastSequence)
        throw new Error("Live history sequences must increase.");
      const slot = positions[value.kind];
      writer.append({
        slot: maxEntries ? value.kind + ":" + slot : "",
        record: raw,
        sequence,
      });
      if (maxEntries) positions[value.kind] = (slot + 1) % maxEntries;
      lastSequence = sequence;
      return undefined;
    },
    flush: writer.flush,
    async close() {
      try {
        await writer.close();
      } finally {
        await database.close();
      }
    },
  };
  return store;
}
