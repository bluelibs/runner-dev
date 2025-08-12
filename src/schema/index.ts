import { GraphQLSchema } from "graphql";
import { QueryType } from "./query";
import {
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
} from "./types/index";

export const schema = new GraphQLSchema({
  query: QueryType,
  types: [
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
  ],
});

// Re-export all types for external usage
export * from "./types/index";
export * from "./model";
export { QueryType } from "./query";
