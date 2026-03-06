import {
  defineResource,
  run,
  defineResourceMiddleware,
  defineEvent,
  r,
} from "@bluelibs/runner";
import { schema } from "../../schema";
import { createDummyApp, dummyAppIds, logMw } from "../dummy/dummyApp";
import { introspector } from "../../resources/introspector.resource";
import { graphql } from "graphql";

const diagnosticsProbeIds = {
  event(localId: string) {
    return `${dummyAppIds.resource("probe-diagnostics")}.events.${localId}`;
  },
  resourceMiddleware(localId: string) {
    return `${dummyAppIds.resource(
      "probe-diagnostics"
    )}.middleware.resource.${localId}`;
  },
  error(localId: string) {
    return `${dummyAppIds.resource("probe-diagnostics")}.errors.${localId}`;
  },
};

describe("Graph diagnostics (component)", () => {
  test("reports orphan event, unused middleware, overridden elements, and unused errors", async () => {
    let ctx: any;

    // Define an event without hooks/emitters
    const orphanEvt = defineEvent({ id: "evt-orphan" });
    const durableInternalOrphanEvt = defineEvent({
      id: "durable-audit-appended",
    });

    // Define a middleware that is not used anywhere
    const unusedMw = defineResourceMiddleware({
      id: "mw-unused",
      async run({ next }) {
        return next();
      },
    });
    const unusedErr = r.error("err-unused").build();

    const logMwOverride = r.override(logMw, async ({ next }) => next());

    const probe = defineResource({
      id: "probe-diagnostics",
      register: [orphanEvt, durableInternalOrphanEvt, unusedMw, unusedErr],
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

    const app = createDummyApp([introspector, probe], {
      overrides: [logMwOverride],
    });
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
      (d) =>
        d.code === "ORPHAN_EVENT" &&
        d.nodeId === diagnosticsProbeIds.event("evt-orphan")
    );
    expect(hasOrphan).toBe(true);

    const hasDurableInternalOrphan = diags.some(
      (d) =>
        d.code === "ORPHAN_EVENT" &&
        d.nodeId === diagnosticsProbeIds.event("durable-audit-appended")
    );
    expect(hasDurableInternalOrphan).toBe(false);

    const hasUnused = diags.some(
      (d) =>
        d.code === "UNUSED_MIDDLEWARE" &&
        d.nodeId === diagnosticsProbeIds.resourceMiddleware("mw-unused")
    );
    expect(hasUnused).toBe(true);

    const hasOverriddenElement = diags.some(
      (d) =>
        d.code === "OVERRIDDEN_ELEMENT" &&
        d.nodeId === dummyAppIds.resourceMiddleware(logMw.id)
    );
    expect(hasOverriddenElement).toBe(true);

    const hasUnusedError = diags.some(
      (d) =>
        d.code === "UNUSED_ERROR" &&
        d.nodeId === diagnosticsProbeIds.error("err-unused")
    );
    expect(hasUnusedError).toBe(true);
  });
});
