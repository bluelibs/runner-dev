import { resources, defineResource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";

export const introspector = defineResource({
  id: "runner-dev-resources-introspector",
  meta: {
    title: "Application Introspector",
    description:
      "Analyzes and provides metadata about the application's tasks, resources, events, and their relationships",
  },
  dependencies: {
    store: resources.store,
    runtime: resources.runtime,
  },
  async init(_, { store, runtime }) {
    const i = new Introspector({ store, runtime });
    initializeFromStore(i, store);
    return i;
  },
});
