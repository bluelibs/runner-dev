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
  EventFilterInput,
  ListenerType,
  MiddlewareType,
  ResourceType,
  TaskType,
  LiveType,
  DiagnosticType,
} from "./types/index";
import type {
  QueryEventArgs,
  QueryEventsArgs,
  QueryMiddlewareArgs,
  QueryMiddlewaresArgs,
  QueryResourceArgs,
  QueryResourcesArgs,
  QueryTaskArgs,
  QueryTasksArgs,
  QueryListenersArgs,
} from "../generated/resolvers-types";
import { isSystemEventId } from "../resources/introspector.tools";

export const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    root: {
      type: ResourceType,
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getRoot(),
    },
    all: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AllType))),
      resolve: (_root, _args, ctx: CustomGraphQLContext) => [
        ...ctx.introspector.getTasks(),
        ...ctx.introspector.getListeners(),
        ...ctx.introspector.getResources(),
        ...ctx.introspector.getMiddlewares(),
        ...ctx.introspector.getEvents(),
      ],
    },
    event: {
      type: EventType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryEventArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEvent(args.id),
    },
    events: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      args: { filter: { type: EventFilterInput } },
      resolve: (_root, args: QueryEventsArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getEvents();
        const filter = args.filter || {
          hideSystem: false,
          hasNoListeners: false,
          idStartsWith: undefined,
        };

        if (filter.hideSystem) {
          result = result.filter(
            (e) =>
              !e.id.startsWith("runner-dev.") &&
              !e.id.startsWith("globals.events") &&
              !isSystemEventId(e.id)
          );
        }
        if (filter.idStartsWith) {
          const pfx = String(filter.idStartsWith);
          result = result.filter((e) => e.id.startsWith(pfx));
        }
        if (typeof filter.hasNoListeners === "boolean") {
          result = result.filter((e) =>
            filter.hasNoListeners
              ? (e.listenedToBy ?? []).length === 0
              : (e.listenedToBy ?? []).length > 0
          );
        }
        return result;
      },
    },
    task: {
      type: TaskType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args: QueryTaskArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTask(args.id),
    },
    tasks: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      args: {
        idStartsWith: { type: GraphQLID },
      },
      resolve: (_root, args: QueryTasksArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getTasks();
        if (args?.idStartsWith) {
          const pfx = String(args.idStartsWith);
          result = result.filter((t) => t.id.startsWith(pfx));
        }
        return result;
      },
    },
    listeners: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ListenerType))
      ),
      args: { idStartsWith: { type: GraphQLID } },
      resolve: (_root, args: QueryListenersArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getListeners();
        if (args?.idStartsWith) {
          const pfx = String(args.idStartsWith);
          result = result.filter((l) => l.id.startsWith(pfx));
        }
        return result;
      },
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
      args: { idStartsWith: { type: GraphQLID } },
      resolve: (
        _root,
        args: QueryMiddlewaresArgs,
        ctx: CustomGraphQLContext
      ) => {
        let result = ctx.introspector.getMiddlewares();
        if (args?.idStartsWith) {
          const pfx = String(args.idStartsWith);
          result = result.filter((m) => m.id.startsWith(pfx));
        }
        return result;
      },
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
      args: { idStartsWith: { type: GraphQLID } },
      resolve: (_root, args: QueryResourcesArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getResources();
        if (args?.idStartsWith) {
          const pfx = String(args.idStartsWith);
          result = result.filter((r) => r.id.startsWith(pfx));
        }
        return result;
      },
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
