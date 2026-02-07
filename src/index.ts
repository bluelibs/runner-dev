import { serverResource } from "./resources/server.resource";
import { introspector } from "./resources/introspector.resource";
import { live } from "./resources/live.resource";
import { telemetry } from "./resources/telemetry.resource";
import { swapManager } from "./resources/swap.resource";
import { graphql } from "./resources/graphql-accumulator.resource";
import { dev } from "./resources/dev.resource";
import { coverage } from "./resources/coverage.resource";

export type { ServerConfig, ServerInstance } from "./resources/server.resource";
export type { CustomGraphQLContext } from "./schema/context";
export type {
  CoverageDetails,
  CoverageService,
  CoverageSummary,
  LineCoverage,
} from "./resources/coverage.resource";
export type {
  EmissionEntry,
  ErrorEntry,
  Live,
  LogEntry,
  LogLevel,
  RunRecord,
} from "./resources/live.resource";
export type {
  EvalResult,
  InvokeEventResult,
  InvokeResult,
  ISwapManager,
  SwapResult,
  SwappedTask,
} from "./resources/swap.resource";
export {
  Introspector,
  type SerializedIntrospector,
} from "./resources/models/Introspector";
export * from "./schema/model";

Error.stackTraceLimit = Infinity;

// Explicit type prevents TS2742 when @bluelibs/runner is linked locally
// (duplicate @types/express-serve-static-core in the runner package)
export const resources = {
  server: serverResource,
  introspector,
  live,
  telemetry,
  swapManager,
  graphql,
  dev,
  coverage,
};

export { dev };
