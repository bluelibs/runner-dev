import { Introspector } from "../../../resources/models/Introspector";
import {
  getHashTargetElementId,
  getVisibilityStateForHashTarget,
} from "./docsHashVisibility";

function createIntrospector() {
  return new Introspector({
    data: {
      tasks: [
        {
          id: "app.tasks.public",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "app.tasks.secret",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: true,
          tags: [],
        },
        {
          id: "runner.tasks.healthcheck",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: false,
          tags: [],
        },
        {
          id: "system.tasks.cleanup",
          emits: [],
          dependsOn: [],
          middleware: [],
          isPrivate: false,
          tags: [],
        },
      ],
      resources: [],
      hooks: [],
      events: [],
      middlewares: [],
      tags: [],
      errors: [],
      asyncContexts: [],
    },
  });
}

describe("docsHashVisibility", () => {
  it("extracts the target id from element hashes", () => {
    expect(getHashTargetElementId("#element-app.tasks.secret")).toBe(
      "app.tasks.secret"
    );
  });

  it("returns the raw decoded hash id for direct element hashes", () => {
    expect(getHashTargetElementId("#runner.tasks.healthcheck")).toBe(
      "runner.tasks.healthcheck"
    );
  });

  it("enables private visibility for private deep links", () => {
    const introspector = createIntrospector();

    expect(
      getVisibilityStateForHashTarget(introspector, "app.tasks.secret", {
        showSystem: false,
        showRunner: true,
        showPrivate: false,
      })
    ).toEqual({
      showSystem: false,
      showRunner: true,
      showPrivate: true,
    });
  });

  it("enables runner visibility for runner deep links", () => {
    const introspector = createIntrospector();

    expect(
      getVisibilityStateForHashTarget(
        introspector,
        "runner.tasks.healthcheck",
        {
          showSystem: false,
          showRunner: false,
          showPrivate: false,
        }
      )
    ).toEqual({
      showSystem: false,
      showRunner: true,
      showPrivate: false,
    });
  });

  it("enables both system and private visibility when the target needs both", () => {
    const introspector = new Introspector({
      data: {
        tasks: [
          {
            id: "system.tasks.secret",
            emits: [],
            dependsOn: [],
            middleware: [],
            isPrivate: true,
            tags: [],
          },
        ],
        resources: [],
        hooks: [],
        events: [],
        middlewares: [],
        tags: [],
        errors: [],
        asyncContexts: [],
      },
    });

    expect(
      getVisibilityStateForHashTarget(introspector, "system.tasks.secret", {
        showSystem: false,
        showRunner: true,
        showPrivate: false,
      })
    ).toEqual({
      showSystem: true,
      showRunner: true,
      showPrivate: true,
    });
  });

  it("leaves visibility unchanged when the target does not exist", () => {
    const introspector = createIntrospector();

    expect(
      getVisibilityStateForHashTarget(introspector, "missing.task", {
        showSystem: false,
        showRunner: false,
        showPrivate: false,
      })
    ).toEqual({
      showSystem: false,
      showRunner: false,
      showPrivate: false,
    });
  });
});
