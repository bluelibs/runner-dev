import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
} from "graphql";
import type { Tag, TagUsage } from "../model";
import { HookType } from "./HookType";
import { TaskType } from "./TaskType";
import { ResourceType } from "./ResourceType";
import { MiddlewareType } from "./MiddlewareType";
import { EventType } from "./EventType";
import type { Introspector } from "../../resources/models/Introspector";
import { BaseElementInterface } from "./AllType";
import { baseElementCommonFields } from "./BaseElementCommon";

export const TagUsageType: GraphQLObjectType<
  TagUsage,
  { introspector: Introspector }
> = new GraphQLObjectType({
  name: "TagUsage",
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLString) },
    configSchema: { type: GraphQLString },
    config: { type: GraphQLString },
  }),
});

export const TagType: GraphQLObjectType<Tag, { introspector: Introspector }> =
  new GraphQLObjectType({
    name: "Tag",
    interfaces: () => [BaseElementInterface],
    fields: () => ({
      ...baseElementCommonFields(),
      configSchema: { type: GraphQLString },
      config: { type: GraphQLString },
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
      all: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(BaseElementInterface))
        ),
        resolve: (tag, _, { introspector }) => {
          return [
            ...introspector.getMiddlewaresWithTag(tag.id),
            ...introspector.getTasksWithTag(tag.id),
            ...introspector.getHooksWithTag(tag.id),
            ...introspector.getResourcesWithTag(tag.id),
            ...introspector.getEventsWithTag(tag.id),
          ];
        },
      },
    }),
  });
