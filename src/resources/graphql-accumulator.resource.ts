import { resource } from "@bluelibs/runner";
import type { CustomGraphQLContext } from "../graphql/context";
import {
  GraphQLFieldConfigMap,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import { QueryType } from "../schema/query";
import { createMutationType } from "../schema/mutation";
import { swapManager } from "./swap.resource";
import {
  AllType,
  BaseElementInterface,
  DiagnosticType,
  EventType,
  ListenerType,
  LiveType,
  MetaType,
  MiddlewareGlobalType,
  MiddlewareType,
  ResourceType,
  SwappedTaskType,
  SwapResultType,
  TaskInterface,
  TaskType,
} from "../schema/types";

// Accumulators that external modules/tests can append to
export const extraTypes: GraphQLNamedType[] = [];
export const extraQueryFields: GraphQLFieldConfigMap<
  any,
  CustomGraphQLContext
> = {};
export const extraMutationFields: GraphQLFieldConfigMap<
  any,
  CustomGraphQLContext
> = {};

function buildQuery(
  additionalQueryFields?: GraphQLFieldConfigMap<any, CustomGraphQLContext>
): GraphQLObjectType {
  const base = QueryType.toConfig();
  return new GraphQLObjectType({
    ...base,
    fields: {
      ...(base.fields as GraphQLFieldConfigMap<any, CustomGraphQLContext>),
      ...(additionalQueryFields ?? {}),
    },
  });
}

export const graphqlAccumulator = resource({
  id: "graphql",
  dependencies: { swapManager },
  async init(_config, { swapManager }) {
    const getSchema = (): GraphQLSchema => {
      const query = buildQuery(extraQueryFields);

      const baseMutation = createMutationType(swapManager);
      const mutation = new GraphQLObjectType({
        ...baseMutation.toConfig(),
        fields: {
          ...baseMutation.toConfig().fields,
          ...extraMutationFields,
        },
      });

      const baseTypes: GraphQLNamedType[] = [
        AllType,
        BaseElementInterface,
        EventType,
        ListenerType,
        MiddlewareGlobalType,
        MiddlewareType,
        MetaType,
        ResourceType,
        TaskInterface,
        TaskType,
        LiveType,
        DiagnosticType,
        SwapResultType,
        SwappedTaskType,
      ];

      return new GraphQLSchema({
        query,
        mutation,
        types: [...baseTypes, ...extraTypes],
      });
    };

    return { getSchema };
  },
});

// Backward-compatible named export to keep `resources.graphql`
export const graphql = graphqlAccumulator;
