import { r } from "@bluelibs/runner";
import { dev, resources, type LivePersistence } from "../../index";

// Compiled by typecheck; deliberately not executed as a Jest suite.
const adapter: LivePersistence = {
  load: () => ({ entries: [], lastSequence: 0 }),
  append: () => {},
};
const provider = r
  .resource("typed-persistence")
  .init(async () => adapter)
  .build();
dev.with({ persistence: provider });
resources.live.with({ persistence: provider });
dev.with({
  persistence: resources.sqlitePersistence.with({ file: "telemetry.sqlite" }),
});

const invalid = r
  .resource("invalid-persistence-output")
  .init(async () => 123)
  .build();
dev.with({
  // @ts-expect-error A provider resource must initialize to a LivePersistence adapter.
  persistence: invalid,
});
resources.live.with({
  // @ts-expect-error Wrong resource outputs must also be rejected by live.with().
  persistence: invalid,
});
const configuredInvalid = r
  .resource<{ file: string }>("invalid-configured-persistence")
  .init(async () => "invalid")
  .build();
dev.with({
  // @ts-expect-error Configured resource entries must preserve provider output checks.
  persistence: configuredInvalid.with({ file: "telemetry.sqlite" }),
});
const invalidSession: LivePersistence = {
  load: () => ({ entries: [], lastSequence: 0 }),
  // @ts-expect-error A promise cannot satisfy synchronous append's undefined return.
  append: async () => {},
};
void invalidSession;
dev.with({
  // @ts-expect-error Persistence lifecycle belongs to a Runner resource.
  persistence: adapter,
});
