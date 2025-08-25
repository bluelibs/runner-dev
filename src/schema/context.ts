import type { Store } from "@bluelibs/runner";
import type { Introspector } from "../resources/models/Introspector";
import type { Live } from "../resources/live.resource";
import type { ISwapManager } from "../resources/swap.resource";
import type { Coverage } from "../resources/coverage.resource";

export interface CustomGraphQLContext {
  store: Store;
  logger: any; // Logger
  introspector: Introspector;
  live: Live;
  swapManager: ISwapManager;
  coverage?: Coverage;
}
