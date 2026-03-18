import { run } from "@bluelibs/runner";
import {
  createEnhancedSuperApp,
  enhancedSuperAppIds,
} from "../dummy/enhanced";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Registered By introspection", () => {
  test("resolves nested resource registrations to their actual owner resource", async () => {
    const runtime = await run(createEnhancedSuperApp(), { debug: {} });

    try {
      const introspector = new Introspector({ store: runtime.store });
      initializeFromStore(introspector, runtime.store);

      const isolationBoundaryId = enhancedSuperAppIds.catalog.resource(
        "isolation-boundary"
      );
      const publicCatalogId = `${isolationBoundaryId}.public-catalog`;
      const catalogSearchTaskId = `${isolationBoundaryId}.tasks.catalog-search`;

      expect(introspector.getResource(publicCatalogId)?.registeredBy).toBe(
        isolationBoundaryId
      );
      expect(introspector.getTask(catalogSearchTaskId)?.registeredBy).toBe(
        isolationBoundaryId
      );
    } finally {
      await runtime.dispose();
    }
  });
});
