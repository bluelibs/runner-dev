import { r, run, subtreeOf } from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Hook selector introspection", () => {
  test("resolves selector-based hook targets and event listeners", async () => {
    const appId = "test-app-hook-selectors";

    const catalogUpdatedEvent = r.event("catalog-updated").build();
    const catalogProjectedEvent = r.event("catalog-projected").build();
    const billingSettledEvent = r.event("billing-settled").build();

    const catalogResource = r
      .resource("catalog")
      .register([catalogUpdatedEvent, catalogProjectedEvent])
      .build();

    const selectorHook = r
      .hook("selector-hook")
      .on([
        subtreeOf(catalogResource, { types: ["event"] }),
        (event) => event.id === `${appId}.events.billing-settled`,
      ])
      .run(async () => {})
      .build();

    const app = r
      .resource(appId)
      .register([catalogResource, billingSettledEvent, selectorHook])
      .build();

    const runtime = await run(app, { debug: {} });

    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const hook = introspector.getHook(`${appId}.hooks.selector-hook`);
      expect(hook?.events).toEqual(
        expect.arrayContaining([
          `${appId}.catalog.events.catalog-updated`,
          `${appId}.catalog.events.catalog-projected`,
          `${appId}.events.billing-settled`,
        ])
      );

      expect(
        introspector
          .getHooksOfEvent(`${appId}.catalog.events.catalog-updated`)
          .map((entry) => entry.id)
      ).toContain(`${appId}.hooks.selector-hook`);

      expect(
        introspector
          .getHooksOfEvent(`${appId}.events.billing-settled`)
          .map((entry) => entry.id)
      ).toContain(`${appId}.hooks.selector-hook`);
    } finally {
      await runtime.dispose();
    }
  });
});
