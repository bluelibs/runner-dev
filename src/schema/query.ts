import {
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import type { CustomGraphQLContext } from "./context";

import {
  AllType,
  BaseElementInterface,
  EventType,
  EventFilterInput,
  HookType,
  MiddlewareType,
  TaskMiddlewareType,
  ResourceMiddlewareType,
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
  QueryHooksArgs,
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
        "Unified view of all elements (tasks, hooks, resources, middleware, events). Prefer specific queries for efficiency.",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(BaseElementInterface))
      ),
      args: {
        idIncludes: {
          description: "Return only elements whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: any, ctx: CustomGraphQLContext) => {
        let result = [
          ...ctx.introspector.getTasks(),
          ...ctx.introspector.getHooks(),
          ...ctx.introspector.getResources(),
          ...ctx.introspector.getMiddlewares(),
          ...ctx.introspector.getEvents(),
        ];
        if (args?.idIncludes) {
          const sub = String(args.idIncludes);
          result = result.filter((e: any) => String(e.id).includes(sub));
        }
        return result;
      },
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
          hasNoHooks: false,
          idIncludes: undefined,
        };

        if (filter.hideSystem) {
          result = result.filter(
            (e) =>
              !e.id.startsWith("runner-dev.") &&
              !e.id.startsWith("globals.events") &&
              !isSystemEventId(e.id)
          );
        }
        if (filter.idIncludes) {
          const sub = String(filter.idIncludes);
          result = result.filter((e) => String(e.id).includes(sub));
        }
        if (typeof filter.hasNoHooks === "boolean") {
          result = result.filter((e) =>
            filter.hasNoHooks
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
        idIncludes: {
          description: "Return only tasks whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: QueryTasksArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getTasks();
        if ((args as any)?.idIncludes) {
          const sub = String((args as any).idIncludes);
          result = result.filter((t) => String(t.id).includes(sub));
        }
        return result;
      },
    },
    hooks: {
      description: "Get all hooks (optionally filter by id prefix).",
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(HookType))),
      args: {
        idIncludes: {
          description: "Return only hooks whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: QueryHooksArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getHooks();
        if ((args as any)?.idIncludes) {
          const sub = String((args as any).idIncludes);
          result = result.filter((l) => String(l.id).includes(sub));
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
        idIncludes: {
          description:
            "Return only middleware whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (
        _root,
        args: QueryMiddlewaresArgs,
        ctx: CustomGraphQLContext
      ) => {
        let result = ctx.introspector.getMiddlewares();
        if ((args as any)?.idIncludes) {
          const sub = String((args as any).idIncludes);
          result = result.filter((m) => String(m.id).includes(sub));
        }
        return result;
      },
    },
    taskMiddlewares: {
      description: "Get all task middlewares (optionally filter by id prefix).",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(TaskMiddlewareType))
      ),
      args: {
        idIncludes: {
          description:
            "Return only middlewares whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: any, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getTaskMiddlewares();
        if (args?.idIncludes) {
          const sub = String(args.idIncludes);
          result = result.filter((m: any) => String(m.id).includes(sub));
        }
        return result;
      },
    },
    resourceMiddlewares: {
      description:
        "Get all resource middlewares (optionally filter by id prefix).",
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(ResourceMiddlewareType))
      ),
      args: {
        idIncludes: {
          description:
            "Return only middlewares whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: any, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getResourceMiddlewares();
        if (args?.idIncludes) {
          const sub = String(args.idIncludes);
          result = result.filter((m: any) => String(m.id).includes(sub));
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
        idIncludes: {
          description:
            "Return only resources whose id contains this substring.",
          type: GraphQLID,
        },
      },
      resolve: (_root, args: QueryResourcesArgs, ctx: CustomGraphQLContext) => {
        let result = ctx.introspector.getResources();
        if ((args as any)?.idIncludes) {
          const sub = String((args as any).idIncludes);
          result = result.filter((r) => String(r.id).includes(sub));
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
