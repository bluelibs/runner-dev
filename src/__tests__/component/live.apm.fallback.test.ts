import { initializeApm } from "../../resources/live/initializeApm";
import { sqliteApmPersistence } from "../../resources/live/sqliteApmPersistence";

jest.mock("../../resources/live/sqliteApmPersistence", () => ({
  sqliteApmPersistence: jest.fn(),
}));
const sqlite = jest.mocked(sqliteApmPersistence);

afterEach(() => jest.resetAllMocks());

test("falls back only when the SQLite builtin is unavailable", async () => {
  const cause = Object.assign(new Error("unavailable"), {
    code: "ERR_UNKNOWN_BUILTIN_MODULE",
  });
  sqlite.mockImplementation(() => {
    throw new Error("SQLite unavailable", { cause });
  });
  const apm = await initializeApm(true);
  expect(apm.snapshot()).toMatchObject({ enabled: true, storage: "memory" });
});

test("does not silently discard database open failures", async () => {
  sqlite.mockImplementation(() => {
    throw new Error("permission denied");
  });
  await expect(initializeApm(true)).rejects.toThrow("permission denied");
});

test("closes a database whose restoration failed", async () => {
  const close = jest.fn(async () => undefined);
  sqlite.mockReturnValue({
    load: async () => {
      throw new Error("corrupt data");
    },
    append: () => undefined,
    close,
    storage: "sqlite",
    flush: async () => undefined,
    status: () => ({ pendingSamples: 0, error: null }),
  });
  await expect(initializeApm(true)).rejects.toThrow("corrupt data");
  expect(close).toHaveBeenCalledTimes(1);
});

test("disabled and explicitly memory-only configurations never load SQLite", async () => {
  await initializeApm(false);
  await initializeApm({ storage: "memory" });
  expect(sqlite).not.toHaveBeenCalled();
});
