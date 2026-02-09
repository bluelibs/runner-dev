import { resource, run, resourceMiddleware, event, r } from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, logMw } from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";

describe("Graph diagnostics (component)", () => {
  test("reports orphan event, unused middleware, overridden elements, and unused errors", async () => {
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
    const unusedErr = r.error("err.unused").build();

    const overrideRes = resource({
      id: "res.override.for.diagnostics",
      overrides: [logMw],
      async init() {
        return {};
      },
    });

    const probe = resource({
      id: "probe.diagnostics",
      register: [orphanEvt, unusedMw, unusedErr],
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

    const app = createDummyApp([introspector, overrideRes, probe]);
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

    const hasOverriddenElement = diags.some(
      (d) => d.code === "OVERRIDDEN_ELEMENT" && d.nodeId === "mw.log"
    );
    expect(hasOverriddenElement).toBe(true);

    const hasUnusedError = diags.some(
      (d) => d.code === "UNUSED_ERROR" && d.nodeId === "err.unused"
    );
    expect(hasUnusedError).toBe(true);
  });
});
