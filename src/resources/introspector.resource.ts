import { globals, resource } from "@bluelibs/runner";
import { Introspector } from "./models/Introspector";

export const introspector = resource({
  id: "runner-dev.resources.introspector",
  dependencies: {
    store: globals.resources.store,
  },
  async init(_, { store }) {
    return new Introspector(store);
  },
});
