import { resource, run, resourceMiddleware, event } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp } from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";

describe("Graph diagnostics (component)", () => {
  test("reports orphan event, unused middleware", async () => {
    let ctx: any;

    // Define an event without hooks/emitters
    const orphanEvt = event({ id: "evt.orphan" });

    // Define a middleware that is not used anywhere
    const unusedMw = resourceMiddleware({
      id: "mw.unused",
      async run({ next }) {
        return next();
      },
    });

    const probe = resource({
      id: "probe.diagnostics",
      register: [orphanEvt, unusedMw],
      dependencies: { introspector },
      async init(_config, { introspector }) {
        ctx = {
          store: undefined,
          logger: console,
          introspector,
          live: { logs: [] },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    const query = `
      query Diagnostics {
        diagnostics { severity code message nodeId nodeKind }
      }
    `;

    const result = await graphql({ schema, source: query, contextValue: ctx });
    expect(result.errors).toBeUndefined();

    const diags: any[] = (result.data as any).diagnostics;
    expect(Array.isArray(diags)).toBe(true);

    const hasOrphan = diags.some(
      (d) => d.code === "ORPHAN_EVENT" && d.nodeId === "evt.orphan"
    );
    expect(hasOrphan).toBe(true);

    const hasUnused = diags.some(
      (d) => d.code === "UNUSED_MIDDLEWARE" && d.nodeId === "mw.unused"
    );
    expect(hasUnused).toBe(true);
  });
});
