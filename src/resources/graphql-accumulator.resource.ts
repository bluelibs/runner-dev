import { resource } from "@bluelibs/runner";
import { GraphQLObjectType, GraphQLSchema } from "graphql";
import { QueryType } from "../schema/query";
import { MutationType } from "../schema/mutation";
import {
  AllType,
  BaseElementInterface,
  DiagnosticType,
  EventType,
  HookType,
  LiveType,
  MetaType,
  MiddlewareGlobalType,
  MiddlewareType,
  ResourceType,
  SwappedTaskType,
  SwapResultType,
  TaskType,
} from "../schema/types";

export const graphqlAccumulator = resource({
  id: "runner-dev.resources.graphql",
  async init(_config) {
    const getSchema = (): GraphQLSchema => {
      const query = new GraphQLObjectType(QueryType.toConfig());
      const mutation = new GraphQLObjectType(MutationType.toConfig());

      const baseTypes = [
        AllType,
        BaseElementInterface,
        EventType,
        HookType,
        MiddlewareGlobalType,
        MiddlewareType,
        MetaType,
        ResourceType,
        TaskType,
        LiveType,
        DiagnosticType,
        SwapResultType,
        SwappedTaskType,
      ];

      return new GraphQLSchema({
        query,
        mutation,
        types: [...baseTypes],
      });
    };

    return { getSchema };
  },
});

// Backward-compatible named export to keep `resources.graphql`
export const graphql = graphqlAccumulator;
