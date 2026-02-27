import {
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
} from "graphql";
import type { Tag, TagUsage } from "../model";
import { HookType } from "./HookType";
import { TaskType } from "./TaskType";
import { ResourceType } from "./ResourceType";
import { ResourceMiddlewareType, TaskMiddlewareType } from "./MiddlewareType";
import { EventType } from "./EventType";
import { ErrorType } from "./ErrorType";
import type { Introspector } from "../../resources/models/Introspector";
import { BaseElementInterface } from "./AllType";
import { baseElementCommonFields } from "./BaseElementCommon";

const TagTargetType = new GraphQLEnumType({
  name: "TagTarget",
  values: {
    TASKS: { value: "tasks" },
    RESOURCES: { value: "resources" },
    EVENTS: { value: "events" },
    HOOKS: { value: "hooks" },
    TASK_MIDDLEWARES: { value: "taskMiddlewares" },
    RESOURCE_MIDDLEWARES: { value: "resourceMiddlewares" },
    ERRORS: { value: "errors" },
  },
});

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
      targets: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(TagTargetType))
        ),
        resolve: (tag) => tag.targets ?? [],
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
      taskMiddlewares: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(TaskMiddlewareType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getTaskMiddlewaresWithTag(tag.id);
        },
      },
      resourceMiddlewares: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(ResourceMiddlewareType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getResourceMiddlewaresWithTag(tag.id);
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
      errors: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(ErrorType))
        ),
        resolve: (tag, _, { introspector }) => {
          return introspector.getErrorsWithTag(tag.id);
        },
      },
      all: {
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(BaseElementInterface))
        ),
        resolve: (tag, _, { introspector }) => {
          return [
            ...introspector.getTaskMiddlewaresWithTag(tag.id),
            ...introspector.getResourceMiddlewaresWithTag(tag.id),
            ...introspector.getTasksWithTag(tag.id),
            ...introspector.getHooksWithTag(tag.id),
            ...introspector.getResourcesWithTag(tag.id),
            ...introspector.getEventsWithTag(tag.id),
            ...introspector.getErrorsWithTag(tag.id),
          ];
        },
      },
    }),
  });
