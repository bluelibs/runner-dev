import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import type { CustomGraphQLContext } from "../graphql/context";

import {
  AllType,
  EventType,
  ListenerType,
  MiddlewareType,
  ResourceType,
  TaskType,
  LiveType,
  DiagnosticType,
} from "./types/index";
import type {
  QueryEventArgs,
  QueryMiddlewareArgs,
  QueryResourceArgs,
  QueryTaskArgs,
} from "../generated/resolvers-types";

export const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    all: {
      type: AllType,
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getRoot(),
    },
    event: {
      type: EventType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryEventArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEvent(args.id),
    },
    events: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEvents(),
    },
    task: {
      type: TaskType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryTaskArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTask(args.id),
    },
    tasks: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTasks(),
    },
    listeners: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ListenerType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getListeners(),
    },
    middleware: {
      type: MiddlewareType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryMiddlewareArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddleware(args.id),
    },
    middlewares: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddlewares(),
    },
    resource: {
      type: ResourceType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryResourceArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResource(args.id),
    },
    resources: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResources(),
    },
    live: {
      type: new GraphQLNonNull(LiveType),
      resolve: () => ({}),
    },
    diagnostics: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(DiagnosticType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getDiagnostics(),
    },
  }),
});
