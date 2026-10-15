import {
  defineHook,
  defineResource,
  defineTask,
  events,
  run,
} from "@bluelibs/runner";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createDummyApp, dummyAppIds } from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { live } from "../../resources/live.resource";
import { telemetry } from "../../resources/telemetry.resource";

describe("Live attribution for work started from a listener opened by a hook", () => {
  test("requests served after the ready hook finished are direct runs with their own correlation ids", async () => {
    const probeResourceId = dummyAppIds.resource("probe-listener");
    const requestTaskId = `${probeResourceId}.tasks.probe-listener-request`;
    const listenHookId = `${probeResourceId}.hooks.probe-listener-listen`;
    let server: Server | undefined;
    let liveService: any;

    const requestTask = defineTask({
      id: "probe-listener-request",
      async run() {
        return "served";
      },
    });

    const listenHook = defineHook({
      id: "probe-listener-listen",
      on: events.ready,
      dependencies: { requestTask },
      async run(_event, { requestTask }) {
        // Node binds every connection callback to this hook's async context.
        server = createServer((_request, response) => {
          requestTask().then((body) => response.end(body));
        });
        await new Promise<void>((resolve) =>
          server!.listen(0, "127.0.0.1", resolve)
        );
      },
    });

    const probe = defineResource({
      id: "probe-listener",
      register: [requestTask, listenHook],
      dependencies: { live },
      async init(_config, { live }) {
        liveService = live;
      },
    });

    const runtime = await run(
      createDummyApp([live, introspector, telemetry, probe])
    );
    try {
      const { port } = server!.address() as AddressInfo;
      for (let i = 0; i < 2; i++) {
        const reply = await fetch(`http://127.0.0.1:${port}/`, {
          headers: { Connection: "close" },
        });
        expect(await reply.text()).toBe("served");
      }

      const runs = liveService.getRuns(0);
      const hookRun = runs.find((entry: any) => entry.nodeId === listenHookId);
      expect(hookRun?.parentId).toBe("system.events.ready");
      const requestRuns = runs.filter(
        (entry: any) => entry.nodeId === requestTaskId
      );
      expect(requestRuns).toHaveLength(2);
      for (const requestRun of requestRuns) {
        expect(requestRun.parentId).toBeNull();
        expect(requestRun.rootId).toBe(requestTaskId);
        expect(requestRun.correlationId).toBeTruthy();
        expect(requestRun.correlationId).not.toBe(hookRun!.correlationId);
      }
      expect(requestRuns[0].correlationId).not.toBe(
        requestRuns[1].correlationId
      );
    } finally {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      await runtime.dispose();
    }
  });
});
