import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { sqlitePersistence } from "../../resources/live/sqlitePersistence";
import { validatePersistenceSnapshot } from "../../resources/live/persistence.schema";
import { createSequenceClock } from "../../resources/live/sequenceClock";
import type { LivePersistedEntry } from "../../resources/live/persistence";

const log = (sequence: number): LivePersistedEntry => ({
  kind: "log",
  entry: {
    sequence,
    timestampMs: sequence,
    level: "info",
    message: `entry-${sequence}`,
  },
});

describe("SQLite telemetry persistence failures and crash recovery", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "runner-dev-sqlite-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  test("recovers committed data after the writer is killed without disposal", async () => {
    const file = join(directory, "crashed.sqlite");
    const child = spawnSync(
      process.execPath,
      [
        "-r",
        "ts-node/register/transpile-only",
        "-e",
        `
      const { sqlitePersistence } = require('./src/resources/live/sqlitePersistence');
      const session = sqlitePersistence({ file: process.argv[1] });
      for (let sequence = 1; sequence <= 4; sequence++) {
        session.append({ kind: 'log', entry: { sequence, timestampMs: sequence, level: 'info', message: 'crash-' + sequence } }, { maxEntries: 2 });
      }
      process.kill(process.pid, 'SIGKILL');
    `,
        file,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, TS_NODE_PROJECT: "config/ts/tsconfig.json" },
        encoding: "utf8",
        timeout: 15000,
      }
    );
    expect(child.error).toBeUndefined();
    expect(child.signal).toBe("SIGKILL");
    const session = await sqlitePersistence({ file });
    try {
      expect(session.load({ maxEntries: 2 })).toMatchObject({
        lastSequence: 4,
        entries: [
          { kind: "log", entry: { message: "crash-3" } },
          { kind: "log", entry: { message: "crash-4" } },
        ],
      });
    } finally {
      await session.close();
    }
  });

  test("rolls back rejected sequences and failed inserts, and continues recording", async () => {
    const file = join(directory, "rollback.sqlite");
    const session = await sqlitePersistence({ file });
    const database = new DatabaseSync(file);
    try {
      session.append(log(1), { maxEntries: 2 });
      expect(() => session.append(log(1), { maxEntries: 2 })).toThrow(
        "sequences must increase"
      );
      database.exec(
        "CREATE TRIGGER fail_insert BEFORE INSERT ON runner_dev_live_entries BEGIN SELECT RAISE(ABORT, 'forced write failure'); END;"
      );
      expect(() => session.append(log(2), { maxEntries: 2 })).toThrow(
        "forced write failure"
      );
      expect(session.load({ maxEntries: 2 }).lastSequence).toBe(1);
      database.exec("DROP TRIGGER fail_insert");
      session.append(log(2), { maxEntries: 2 });
      expect(session.load({ maxEntries: 2 }).entries).toEqual([log(1), log(2)]);
    } finally {
      database.close();
      await session.close();
    }
  });

  test("keeps the last sequence when a zero cap evicts every entry", async () => {
    const file = join(directory, "empty.sqlite");
    const options = { file };
    const first = await sqlitePersistence(options);
    try {
      first.append(log(5), { maxEntries: 0 });
      expect(first.load({ maxEntries: 0 })).toEqual({
        entries: [],
        lastSequence: 5,
      });
    } finally {
      await first.close();
    }
    const second = await sqlitePersistence(options);
    try {
      expect(second.load({ maxEntries: 0 })).toEqual({
        entries: [],
        lastSequence: 5,
      });
    } finally {
      await second.close();
    }
  });

  test("rejects invalid snapshots before committing or advancing the cursor", async () => {
    const file = join(directory, "validation.sqlite");
    const options = { file };
    const first = await sqlitePersistence(options);
    try {
      first.append(log(1), { maxEntries: 2 });
      expect(() =>
        first.append(
          {
            kind: "run",
            entry: {
              sequence: 2,
              timestampMs: 2,
              nodeId: "invalid-duration",
              nodeKind: "TASK",
              durationMs: Infinity,
              ok: true,
            },
          },
          { maxEntries: 2 }
        )
      ).toThrow();
      expect(first.load({ maxEntries: 2 })).toEqual({
        entries: [log(1)],
        lastSequence: 1,
      });
      first.append(log(2), { maxEntries: 2 });
    } finally {
      await first.close();
    }
    const second = await sqlitePersistence(options);
    try {
      expect(second.load({ maxEntries: 2 })).toEqual({
        entries: [log(1), log(2)],
        lastSequence: 2,
      });
    } finally {
      await second.close();
    }
  });

  test("rejects invalid configuration and unsupported database versions", async () => {
    expect(() => sqlitePersistence({ file: " " })).toThrow(
      "non-empty file path"
    );
    const invalid = sqlitePersistence({ file: ":memory:" });
    expect(() => invalid.load({ maxEntries: -1 })).toThrow(
      "non-negative integer"
    );
    expect(() => invalid.append(log(1), { maxEntries: -1 })).toThrow(
      "non-negative integer"
    );
    invalid.close();
    const file = join(directory, "version.sqlite");
    const session = await sqlitePersistence({ file });
    await session.close();
    const database = new DatabaseSync(file);
    try {
      database.exec("UPDATE runner_dev_live_meta SET version = 2");
    } finally {
      database.close();
    }
    expect(() => sqlitePersistence({ file })).toThrow("Unsupported");
  });

  test("rejects corrupted retained records at restore", async () => {
    const file = join(directory, "corrupt.sqlite");
    const session = await sqlitePersistence({ file });
    session.append(log(1), { maxEntries: 2 });
    const database = new DatabaseSync(file);
    try {
      database.exec("UPDATE runner_dev_live_entries SET record = '{}' ");
      expect(() => session.load({ maxEntries: 2 })).toThrow();
    } finally {
      database.close();
      await session.close();
    }
  });

  test("rejects invalid snapshot ordering, category fields and exhausted cursors", () => {
    expect(() =>
      validatePersistenceSnapshot({
        entries: [log(2), log(1)],
        lastSequence: 2,
      })
    ).toThrow("ordered");
    expect(() =>
      validatePersistenceSnapshot({
        entries: [log(1), log(1)],
        lastSequence: 1,
      })
    ).toThrow("unique");
    expect(() =>
      validatePersistenceSnapshot({ entries: [log(2)], lastSequence: 1 })
    ).toThrow("lastSequence");
    expect(() => createSequenceClock(Number.MAX_SAFE_INTEGER)(0)).toThrow(
      "safe integer"
    );
  });
});
