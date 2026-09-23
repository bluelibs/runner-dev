import {
  buildEmissionMatcher,
  buildErrorMatcher,
  buildLogMatcher,
  buildRunMatcher,
} from "../../resources/live/entryMatchers";
import type {
  EmissionEntry,
  ErrorEntry,
  LogEntry,
  RunRecord,
} from "../../resources/live.resource";

const stamp = { sequence: 1, timestampMs: 1 };

const log: LogEntry = {
  ...stamp,
  level: "warn",
  message: "disk almost full",
  correlationId: "c-1",
};

const emission: EmissionEntry = {
  ...stamp,
  eventId: "app.events.ready",
  emitterId: "app.tasks.boot",
  correlationId: "c-1",
};

const error: ErrorEntry = {
  ...stamp,
  sourceId: "app.tasks.boot",
  sourceKind: "TASK",
  message: "boom",
  correlationId: null,
};

const run: RunRecord = {
  ...stamp,
  nodeId: "app.tasks.boot",
  nodeKind: "TASK",
  durationMs: 5,
  ok: true,
  parentId: "app.hooks.onReady",
  rootId: "system.events.ready",
  correlationId: "c-2",
};

describe("live entry matchers", () => {
  test("empty filters match everything", () => {
    expect(buildLogMatcher({ levels: [], correlationIds: [] })(log)).toBe(true);
    expect(buildEmissionMatcher({ eventIds: [] })(emission)).toBe(true);
    expect(buildErrorMatcher({ messageIncludes: "" })(error)).toBe(true);
    expect(buildRunMatcher({})(run)).toBe(true);
  });

  test("log filters: level, message fragment and correlation", () => {
    expect(buildLogMatcher({ levels: ["warn"] })(log)).toBe(true);
    expect(buildLogMatcher({ levels: ["info"] })(log)).toBe(false);
    expect(buildLogMatcher({ messageIncludes: "full" })(log)).toBe(true);
    expect(buildLogMatcher({ messageIncludes: "empty" })(log)).toBe(false);
    expect(buildLogMatcher({ correlationIds: ["c-1"] })(log)).toBe(true);
    expect(buildLogMatcher({ correlationIds: ["c-9"] })(log)).toBe(false);
  });

  test("emission filters accept short ids and require every filter", () => {
    expect(buildEmissionMatcher({ eventIds: ["ready"] })(emission)).toBe(true);
    expect(buildEmissionMatcher({ emitterIds: ["boot"] })(emission)).toBe(true);
    expect(
      buildEmissionMatcher({ eventIds: ["ready"], emitterIds: ["other"] })(
        emission
      )
    ).toBe(false);
    expect(
      buildEmissionMatcher({ emitterIds: ["boot"] })({
        ...emission,
        emitterId: null,
      })
    ).toBe(false);
  });

  test("error filters: kind, source, message and missing correlation", () => {
    expect(buildErrorMatcher({ sourceKinds: ["TASK"] })(error)).toBe(true);
    expect(buildErrorMatcher({ sourceKinds: ["HOOK"] })(error)).toBe(false);
    expect(buildErrorMatcher({ sourceIds: ["boot"] })(error)).toBe(true);
    expect(buildErrorMatcher({ messageIncludes: "boo" })(error)).toBe(true);
    // Entries without a correlation id compare as the string "null".
    expect(buildErrorMatcher({ correlationIds: ["null"] })(error)).toBe(true);
  });

  test("run filters: kind, node, outcome, parent, root and correlation", () => {
    expect(buildRunMatcher({ nodeKinds: ["TASK"] })(run)).toBe(true);
    expect(buildRunMatcher({ nodeIds: ["boot"] })(run)).toBe(true);
    expect(buildRunMatcher({ ok: true })(run)).toBe(true);
    expect(buildRunMatcher({ ok: false })(run)).toBe(false);
    expect(buildRunMatcher({ parentIds: ["onReady"] })(run)).toBe(true);
    expect(buildRunMatcher({ rootIds: ["ready"] })(run)).toBe(true);
    expect(buildRunMatcher({ rootIds: ["other"] })(run)).toBe(false);
    expect(buildRunMatcher({ correlationIds: ["c-2"] })(run)).toBe(true);
  });
});
