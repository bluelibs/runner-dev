import { defineResource, defineTask, resources, run } from "@bluelibs/runner";
import { graphql } from "graphql";

import { schema } from "../../schema";
import { introspector } from "../../resources/introspector.resource";
import { Introspector } from "../../resources/models/Introspector";

const APP_ID = "boundary-surface-app";
const BILLING_ID = `${APP_ID}.billing`;

const publicServiceTask = defineTask({
  id: "public-service-task",
  run: async () => "public",
});

const privateServiceTask = defineTask({
  id: "private-service-task",
  run: async () => "private",
});

const directPublicTask = defineTask({
  id: "direct-public",
  run: async () => "public",
});

const directPrivateTask = defineTask({
  id: "direct-private",
  run: async () => "private",
});

const publicService = defineResource({
  id: "public-service",
  register: [publicServiceTask],
});

const privateService = defineResource({
  id: "private-service",
  register: [privateServiceTask],
  isolate: { exports: "none" },
});

const billing = defineResource({
  id: "billing",
  register: [
    publicService,
    privateService,
    directPublicTask,
    directPrivateTask,
  ],
  isolate: { exports: [publicService, directPublicTask] },
});

describe("GraphQL boundary surfaces", () => {
  it("exposes declared, effective, and private boundary definitions", async () => {
    let context:
      | {
          introspector: Introspector;
          store: unknown;
          logger: unknown;
          live: { logs: unknown[] };
        }
      | undefined;

    const probe = defineResource({
      id: "probe",
      dependencies: { introspector, store: resources.store },
      init: async (_config, dependencies) => {
        context = {
          introspector: dependencies.introspector,
          store: dependencies.store,
          logger: console,
          live: { logs: [] },
        };
      },
    });

    const app = defineResource({
      id: APP_ID,
      register: [introspector, billing, probe],
    });

    const runtime = await run(app, { shutdownHooks: false });

    try {
      expect(context).toBeDefined();
      const result = await graphql({
        schema,
        source: `
          query BoundarySurface($ownerId: ID!) {
            boundary(ownerId: $ownerId) {
              ownerId
              exportsDeclared
              declaredExports
              effectiveExports
              privateDefinitions
            }
            boundaries(ownerIdIncludes: "${BILLING_ID}") {
              ownerId
              effectiveExports
            }
            resource(id: $ownerId) {
              id
              surface {
                ownerId
              }
            }
          }
        `,
        variableValues: { ownerId: BILLING_ID },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      const data = result.data as {
        boundary: {
          ownerId: string;
          exportsDeclared: boolean;
          declaredExports: string[];
          effectiveExports: string[];
          privateDefinitions: string[];
        };
        boundaries: Array<{ ownerId: string; effectiveExports: string[] }>;
        resource: { id: string; surface: { ownerId: string } };
      };

      expect(data.boundary).toEqual({
        ownerId: BILLING_ID,
        exportsDeclared: true,
        declaredExports: [
          `${BILLING_ID}.public-service`,
          `${BILLING_ID}.tasks.direct-public`,
        ],
        effectiveExports: [
          `${BILLING_ID}.public-service`,
          `${BILLING_ID}.public-service.tasks.public-service-task`,
          `${BILLING_ID}.tasks.direct-public`,
        ],
        privateDefinitions: [
          `${BILLING_ID}.private-service`,
          `${BILLING_ID}.private-service.tasks.private-service-task`,
          `${BILLING_ID}.tasks.direct-private`,
        ],
      });
      expect(data.boundaries.map(({ ownerId }) => ownerId)).toEqual([
        BILLING_ID,
        `${BILLING_ID}.private-service`,
        `${BILLING_ID}.public-service`,
      ]);
      expect(data.resource).toEqual({
        id: BILLING_ID,
        surface: { ownerId: BILLING_ID },
      });

      const snapshotIntrospector = Introspector.deserialize(
        context!.introspector.serialize()
      );
      expect(
        snapshotIntrospector.getBoundarySurface(BILLING_ID)?.effectiveExports
      ).toEqual(data.boundary.effectiveExports);
    } finally {
      await runtime.dispose();
    }
  });
});
