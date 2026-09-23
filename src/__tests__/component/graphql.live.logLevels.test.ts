import { defineHook, events, resources, run } from "@bluelibs/runner";
import { graphql } from "graphql";
import { schema } from "../../schema";
import type { CustomGraphQLContext } from "../../schema/context";
import { resources as devResources } from "../../index";
import { createDummyApp } from "../dummy/dummyApp";

describe("GraphQL live logs: Runner log levels", () => {
  test("serializes and filters Runner's critical level", async () => {
    const logCritical = defineHook({
      id: "probe-log-levels-critical",
      on: events.ready,
      dependencies: { logger: resources.logger },
      async run(_event, { logger }) {
        await logger.critical("reactor meltdown");
        await logger.info("all good");
      },
    });

    const runtime = await run(
      createDummyApp([
        devResources.live,
        devResources.introspector,
        devResources.swapManager,
        logCritical,
      ]),
      { logs: { printThreshold: null } }
    );
    try {
      const contextValue: Pick<
        CustomGraphQLContext,
        "live" | "introspector" | "swapManager"
      > = {
        live: runtime.getResourceValue(devResources.live),
        introspector: runtime.getResourceValue(devResources.introspector),
        swapManager: runtime.getResourceValue(devResources.swapManager),
      };

      const result = await graphql({
        schema,
        contextValue,
        source: `{
          live {
            all: logs { level message }
            critical: logs(filter: { levels: [critical] }) { level message }
          }
        }`,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.live).toMatchObject({
        all: expect.arrayContaining([
          { level: "critical", message: "reactor meltdown" },
          { level: "info", message: "all good" },
        ]),
        critical: [{ level: "critical", message: "reactor meltdown" }],
      });
    } finally {
      await runtime.dispose();
    }
  });
});
