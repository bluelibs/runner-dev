import type { Store } from "@bluelibs/runner";
import type { Introspector } from "../resources/models/Introspector";
import type { Live } from "../resources/live.resource";
import type { ISwapManager } from "../resources/swap.resource";

export interface CustomGraphQLContext {
  store: Store;
  logger: any; // Logger
  introspector: Introspector;
  live: Live;
  swapManager: ISwapManager;
}
