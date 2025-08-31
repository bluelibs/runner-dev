import { resource, type Store } from "@bluelibs/runner";
import { cliConfig } from "./cli.config.resource";
import { introspectorCli } from "./introspector.cli.resource";
import { live } from "./live.resource";
import { swapManagerCli } from "./swap.cli.resource";
import { graphql as graphqlAccumulator } from "./graphql-accumulator.resource";
import { graphqlQueryCliTask } from "./graphql.query.cli.task";

export const graphqlCli = resource({
  id: "runner-dev.resources.graphql-cli",
  // Accept a prebuilt Store via cli-config sibling resource
  register: (config: { customStore: Store }) => [
    cliConfig.with({ customStore: config.customStore }),
    introspectorCli,
    live,
    swapManagerCli,
    graphqlAccumulator,
    graphqlQueryCliTask,
  ],
  async init() {
    // No value needed; harness only
    return {};
  },
});
