import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import type { Tag } from "../model";
import { HookType } from "./HookType";
import { TaskType } from "./TaskType";
import { ResourceType } from "./ResourceType";
import { MiddlewareType } from "./MiddlewareType";
import { EventType } from "./EventType";
import type { Introspector } from "../../resources/models/Introspector";

export const TagType: GraphQLObjectType<Tag, { introspector: Introspector }> =
  new GraphQLObjectType({
    name: "Tag",
    fields: () => ({
      id: {
        type: new GraphQLNonNull(GraphQLString),
      },
      tasks: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))),
        resolve: (tag, _, { introspector }) => {
          return introspector.getTasksWithTag(tag.id);
        },
      },
      hooks: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(HookType))),
        resolve: (tag, _, { introspector }) => {
          return introspector.getHooksWithTag(tag.id);
        },
      },
      resources: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(ResourceType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getResourcesWithTag(tag.id);
        },
      },
      middlewares: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(MiddlewareType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getMiddlewaresWithTag(tag.id);
        },
      },
      events: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(EventType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getEventsWithTag(tag.id);
        },
      },
    }),
  });
