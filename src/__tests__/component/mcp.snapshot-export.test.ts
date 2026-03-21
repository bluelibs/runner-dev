import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  Match,
  defineEvent,
  defineResource,
  defineResourceMiddleware,
  defineTask,
} from "@bluelibs/runner";
import { callGraphQL } from "../../mcp/http";
import { fetchSchemaSDL } from "../../mcp/schema";
import { exportDocs } from "../../exportDocs";
import * as packageDocs from "../../docs/packageDocs";
import * as docsUiAssets from "../../resources/docsUiAssets";

function createApp() {
  const unusedResourceMiddleware = defineResourceMiddleware({
    id: "unused-resource-middleware",
    async run({ next }) {
      return next();
    },
  });

  const settingsResource = defineResource({
    id: "settings",
    meta: {
      title: "Settings Resource",
      description: "Carries config schema data into the export",
    },
    configSchema: Match.compile(Match.ObjectIncluding({ ttlMs: Number })),
    async init() {
      return { ttlMs: 1000 };
    },
  });
  const configuredSettingsResource = settingsResource.with({ ttlMs: 1000 });

  const pingedEvent = defineEvent({
    id: "pinged",
    meta: { title: "Pinged Event", description: "Raised by the ping task" },
    payloadSchema: Match.compile(Match.ObjectIncluding({ ok: Boolean })),
  });

  const pingTask = defineTask({
    id: "ping",
    meta: {
      title: "Ping Task",
      description: "Sends a polite ping",
    },
    inputSchema: Match.compile(Match.ObjectIncluding({ name: String })),
    dependencies: () => ({
      settingsResource,
      emitPinged: pingedEvent,
    }),
    async run(_input, { emitPinged }) {
      await emitPinged({ ok: true });
      return "pong";
    },
  });

  return defineResource({
    id: "tests-mcp-export-app",
    register: [
      unusedResourceMiddleware,
      configuredSettingsResource,
      pingedEvent,
      pingTask,
    ],
  });
}

describe("snapshot-backed MCP from exportDocs()", () => {
  const ORIGINAL_ENV = { ...process.env };
  let tmpRoot: string;
  let uiDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-mcp-"));
    uiDir = path.join(tmpRoot, "ui");

    await fs.mkdir(path.join(uiDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(uiDir, "docs"), { recursive: true });
    await fs.writeFile(
      path.join(uiDir, "assets", "docs.js"),
      "console.log('mcp export test');"
    );
    await fs.writeFile(path.join(uiDir, "assets", "docs.css"), "body{}");
    await fs.writeFile(path.join(uiDir, "docs", "favicon.ico"), "ico");

    jest.spyOn(docsUiAssets, "resolveDocsBuildAssets").mockResolvedValue({
      uiDir,
      entry: {
        file: "assets/docs.js",
        css: ["assets/docs.css"],
      },
    });
    jest
      .spyOn(packageDocs, "readFirstAvailablePackageDoc")
      .mockImplementation(
        async () => ({ content: "# Runner Docs", path: "mock" } as any)
      );
    jest
      .spyOn(packageDocs, "readPackageDoc")
      .mockImplementation(
        async () => ({ content: "# Runner Dev Docs", path: "mock" } as any)
      );
  });

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("supports project-overview style queries against an exported snapshot", async () => {
    const exported = await exportDocs(createApp(), {
      output: path.join(tmpRoot, "catalog"),
    });
    const snapshot = JSON.parse(
      await fs.readFile(exported.snapshotPath, "utf8")
    ) as any;

    expect(typeof snapshot.graphqlSdl).toBe("string");
    expect(snapshot.graphqlSdl).toContain("type Query");

    process.env.SNAPSHOT_FILE = exported.snapshotPath;
    delete process.env.ENDPOINT;
    delete process.env.GRAPHQL_ENDPOINT;

    const result = (await callGraphQL({
      query: `
        query OverviewSnapshot {
          all(idIncludes: "tests-mcp-export-app") {
            __typename
            id
          }
          unusedResourceMiddleware: all(idIncludes: "unused-resource-middleware") {
            __typename
            id
            ... on ResourceMiddleware {
              usedBy { id }
            }
          }
          tasks(idIncludes: "ping") {
            id
            inputSchemaReadable
          }
          resources(idIncludes: "settings") {
            id
            configSchemaReadable
          }
          events(filter: { idIncludes: "pinged", hideSystem: true }) {
            id
            payloadSchemaReadable
            emittedBy
          }
          live {
            logs(last: 5) {
              timestampMs
            }
          }
        }
      `,
    })) as any;

    expect(result.errors).toBeUndefined();
    expect(result.data.all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          __typename: "Task",
          id: "tests-mcp-export-app.tasks.ping",
        }),
        expect.objectContaining({
          __typename: "Resource",
          id: "tests-mcp-export-app.settings",
        }),
        expect.objectContaining({
          __typename: "Event",
          id: "tests-mcp-export-app.events.pinged",
        }),
      ])
    );
    expect(result.data.unusedResourceMiddleware).toEqual([
      {
        __typename: "ResourceMiddleware",
        id: "tests-mcp-export-app.middleware.resource.unused-resource-middleware",
        usedBy: [],
      },
    ]);
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.resources).toHaveLength(1);
    expect(result.data.events).toHaveLength(1);
    expect(result.data.tasks[0].inputSchemaReadable).toContain("name");
    expect(result.data.resources[0].configSchemaReadable).toContain("ttlMs");
    expect(result.data.events[0].payloadSchemaReadable).toContain("ok");
    expect(result.data.events[0].emittedBy).toEqual(
      expect.arrayContaining(["tests-mcp-export-app.tasks.ping"])
    );
    expect(
      result.data.events.some(
        (event: any) => event.id === "system.events.ready"
      )
    ).toBe(false);
    expect(result.data.live.logs).toEqual([]);

    await expect(fetchSchemaSDL()).resolves.toContain("type Query");
    await expect(fetchSchemaSDL()).resolves.toContain("inputSchemaReadable");
  });
});
