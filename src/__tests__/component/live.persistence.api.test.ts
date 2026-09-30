import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Request, Response } from "express";
import { r, run } from "@bluelibs/runner";
import { graphql } from "graphql";
import { schema } from "../../schema";
import { live } from "../../resources/live.resource";
import { sqlitePersistenceResource } from "../../resources/live/sqlitePersistence.resource";
import { sqlitePersistence } from "../../resources/live/sqlitePersistence";
import { createLiveStreamHandler } from "../../resources/routeHandlers/createLiveStreamHandler";

test("restored history is queryable through GraphQL and replayed on SSE connect", async () => {
  const directory = mkdtempSync(join(tmpdir(), "runner-dev-persisted-api-"));
  const options = { file: join(directory, "live.sqlite") };
  const persistence = sqlitePersistenceResource.with(options);
  try {
    const session = sqlitePersistence(options);
    try {
      session.append(
        {
          kind: "log",
          entry: {
            sequence: 1,
            timestampMs: 1,
            level: "info",
            message: "restored log",
          },
        },
        { maxEntries: 20 }
      );
      session.append(
        {
          kind: "emission",
          entry: {
            sequence: 2,
            timestampMs: 2,
            eventId: "restored-event",
            payload: { answer: 42 },
          },
        },
        { maxEntries: 20 }
      );
      session.append(
        {
          kind: "error",
          entry: {
            sequence: 3,
            timestampMs: 3,
            sourceId: "restored-source",
            sourceKind: "TASK",
            message: "restored error",
          },
        },
        { maxEntries: 20 }
      );
      session.append(
        {
          kind: "run",
          entry: {
            sequence: 4,
            timestampMs: 4,
            nodeId: "restored-task",
            nodeKind: "TASK",
            durationMs: 2,
            ok: true,
          },
        },
        { maxEntries: 20 }
      );
    } finally {
      await session.close();
    }
    const root = r
      .resource("persisted-api")
      .register([live.with({ persistence, maxEntries: 20 })])
      .build();
    const runtime = await run(root);
    try {
      const store = runtime.getResourceValue(live);
      const result = await graphql({
        schema,
        contextValue: { live: store },
        source: `query {
          live {
            logs(filter: { messageIncludes: "restored log" }) { sequence message }
            emissions { sequence eventId payload }
            errors { sequence message }
            runs { sequence nodeId }
          }
        }`,
      });
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        live: {
          logs: [{ sequence: 1, message: "restored log" }],
          emissions: [
            {
              sequence: 2,
              eventId: "restored-event",
              payload: '{"answer":42}',
            },
          ],
          errors: [{ sequence: 3, message: "restored error" }],
          runs: [{ sequence: 4, nodeId: "restored-task" }],
        },
      });
      const frames: string[] = [];
      const handlers = new Map<string, () => void>();
      const response = {
        setHeader: () => {},
        flushHeaders: () => {},
        write: (frame: string) => {
          frames.push(frame);
          return true;
        },
        on: (event: string, handler: () => void) => {
          handlers.set(event, handler);
        },
      };
      // Only the documented HTTP methods exercised by this handler are needed.
      createLiveStreamHandler({ live: store })(
        {} as Request,
        response as unknown as Response
      );
      try {
        const replay = frames.find((frame) =>
          frame.startsWith("event: telemetry")
        );
        expect(replay).toContain('"message":"restored log"');
        expect(replay).toContain('"eventId":"restored-event"');
        expect(replay).toContain('"message":"restored error"');
        expect(replay).toContain('"nodeId":"restored-task"');
      } finally {
        handlers.get("close")?.();
      }
    } finally {
      await runtime.dispose();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
