import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import type { CustomGraphQLContext } from "../graphql/context";

import {
  AllType,
  BaseElementInterface,
  EventType,
  EventFilterInput,
  ListenerType,
  MiddlewareType,
  ResourceType,
  TaskType,
  LiveType,
  DiagnosticType,
} from "./types/index";
import { SwappedTaskType } from "./types/SwapType";
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
  description:
    "Root queries for introspection, live telemetry, and debugging of Runner apps.",
  fields: () => ({
    root: {
      description:
        "Root application 'resource'. This is what the main run() received as argument.",
      type: ResourceType,
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getRoot(),
    },
    all: {
      description:
        "Unified view of all elements (tasks, listeners, resources, middleware, events). Prefer specific queries for efficiency.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) => [
        ...ctx.introspector.getTasks(),
        ...ctx.introspector.getListeners(),
        ...ctx.introspector.getResources(),
        ...ctx.introspector.getMiddlewares(),
        ...ctx.introspector.getEvents(),
      ],
    },
    event: {
      description: "Get a single event by its id.",
      type: EventType,
      args: {
        id: {
          description: "Event id",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_root, args: QueryEventArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getEvent(args.id),
    },
    events: {
      description: "List events with optional filters.",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventType))),
      args: {
        filter: {
          description:
            "Filter events. Use hideSystem to hide internal/system events.",
          type: EventFilterInput,
        },
      },
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
      description: "Get a single task by its id.",
      type: TaskType,
      args: {
        id: {
          description: "Task id",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_root, args: QueryTaskArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getTask(args.id),
    },
    tasks: {
      description: "Get all tasks (optionally filter by id prefix).",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
      args: {
        idStartsWith: {
          description: "Return only tasks whose id starts with this prefix.",
          type: GraphQLID,
        },
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
      description: "Get all listeners (optionally filter by id prefix).",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ListenerType))
      ),
      args: {
        idStartsWith: {
          description:
            "Return only listeners whose id starts with this prefix.",
          type: GraphQLID,
        },
      },
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
      description: "Get a single middleware by its id.",
      type: MiddlewareType,
      args: {
        id: {
          description: "Middleware id",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_root, args: QueryMiddlewareArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getMiddleware(args.id),
    },
    middlewares: {
      description: "Get all middleware (optionally filter by id prefix).",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(MiddlewareType))
      ),
      args: {
        idStartsWith: {
          description:
            "Return only middleware whose id starts with this prefix.",
          type: GraphQLID,
        },
      },
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
      description: "Get a single resource by its id.",
      type: ResourceType,
      args: {
        id: {
          description: "Resource id",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: (_root, args: QueryResourceArgs, ctx: CustomGraphQLContext) =>
        ctx.introspector.getResource(args.id),
    },
    resources: {
      description: "Get all resources (optionally filter by id prefix).",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceType))
      ),
      args: {
        idStartsWith: {
          description:
            "Return only resources whose id starts with this prefix.",
          type: GraphQLID,
        },
      },
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
      description:
        "Access live telemetry (logs, emissions, errors, runs, system stats). Always use filters and last to limit payload.",
      type: new GraphQLNonNull(LiveType),
      resolve: () => ({}),
    },
    diagnostics: {
      description:
        "Diagnostics for potential issues discovered by the introspector.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(DiagnosticType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.introspector.getDiagnostics(),
    },
    swappedTasks: {
      description: "List of tasks currently hot-swapped.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(SwappedTaskType))
      ),
      resolve: (_root, _args, ctx: CustomGraphQLContext) =>
        ctx.swapManager.getSwappedTasks(),
    },
  }),
});
