import { createApm } from "../../resources/live/apm";
import { sqliteApmPersistence } from "../../resources/live/sqliteApmPersistence";

jest.mock("../../resources/live/sqliteApmPersistence", () => ({
  sqliteApmPersistence: jest.fn(),
}));
const sqlite = jest.mocked(sqliteApmPersistence);

afterEach(() => jest.resetAllMocks());

test("falls back only when the SQLite builtin is unavailable", () => {
  const cause = Object.assign(new Error("unavailable"), {
    code: "ERR_UNKNOWN_BUILTIN_MODULE",
  });
  sqlite.mockImplementation(() => {
    throw new Error("SQLite unavailable", { cause });
  });
  const apm = createApm(true);
  expect(apm.snapshot()).toMatchObject({ enabled: true, storage: "memory" });
});

test("does not silently discard database open failures", () => {
  sqlite.mockImplementation(() => {
    throw new Error("permission denied");
  });
  expect(() => createApm(true)).toThrow("permission denied");
});

test("closes a database whose restoration failed", () => {
  const close = jest.fn(async () => undefined);
  sqlite.mockReturnValue({
    load: () => {
      throw new Error("corrupt data");
    },
    append: () => undefined,
    close,
    storage: "sqlite",
    flush: async () => undefined,
    status: () => ({ pendingSamples: 0, error: null }),
  });
  expect(() => createApm(true)).toThrow("corrupt data");
  expect(close).toHaveBeenCalledTimes(1);
});

test("disabled and explicitly memory-only configurations never load SQLite", () => {
  createApm(false);
  createApm({ storage: "memory" });
  expect(sqlite).not.toHaveBeenCalled();
});
