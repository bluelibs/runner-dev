import { defineResource } from "@bluelibs/runner";
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
  MiddlewareAutoApplyType,
  MiddlewareApplyScopeType,
  MiddlewareType,
  TaskMiddlewareType,
  ResourceMiddlewareType,
  ResourceType,
  SwappedTaskType,
  SwapResultType,
  TaskType,
  InterceptorOwnersSnapshotType,
} from "../schema/types";

export function createRunnerDevGraphqlSchema(): GraphQLSchema {
  const query = new GraphQLObjectType(QueryType.toConfig());
  const mutation = new GraphQLObjectType(MutationType.toConfig());

  const baseTypes = [
    AllType,
    BaseElementInterface,
    EventType,
    HookType,
    MiddlewareAutoApplyType,
    MiddlewareApplyScopeType,
    MiddlewareType,
    TaskMiddlewareType,
    ResourceMiddlewareType,
    MetaType,
    ResourceType,
    TaskType,
    LiveType,
    DiagnosticType,
    SwapResultType,
    SwappedTaskType,
    InterceptorOwnersSnapshotType,
  ];

  return new GraphQLSchema({
    query,
    mutation,
    types: [...baseTypes],
  });
}

export const graphqlAccumulator = defineResource({
  id: "graphql",
  meta: {
    title: "GraphQL Schema Builder",
    description:
      "Constructs and manages the GraphQL schema with all types, queries, and mutations for the Runner-Dev API",
  },
  async init(_config) {
    const getSchema = (): GraphQLSchema => {
      return createRunnerDevGraphqlSchema();
    };

    return { getSchema };
  },
});

// Backward-compatible named export to keep `resources.graphql`
export const graphql = graphqlAccumulator;
