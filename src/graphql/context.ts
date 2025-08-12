import type { Store } from "@bluelibs/runner";
import type { Introspector } from "../resources/introspector.resource";
import type { Live } from "../resources/live.resource";

export interface CustomGraphQLContext {
  store: Store;
  logger: any; // Logger
  introspector: Introspector;
  live: Live;
}
