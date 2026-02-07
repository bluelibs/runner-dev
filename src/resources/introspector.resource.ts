import { globals, resource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";
import { initializeFromStore } from "./models/initializeFromStore";

export const introspector = resource({
  id: "runner-dev.resources.introspector",
  meta: {
    title: "Application Introspector",
    description:
      "Analyzes and provides metadata about the application's tasks, resources, events, and their relationships",
  },
  dependencies: {
    store: globals.resources.store,
  },
  async init(_, { store }) {
    const i = new Introspector({ store });
    initializeFromStore(i, store);
    return i;
  },
});
