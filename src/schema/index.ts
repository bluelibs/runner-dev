import { GraphQLSchema } from "graphql";
import { QueryType } from "./query";
import { MutationType } from "./mutation";
import type { SwapManager } from "../resources/swap.resource";
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
  SwapResultType,
  SwappedTaskType,
} from "./types/index";

export const createSchema = (swapManager?: SwapManager) => {
  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
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
      SwapResultType,
      SwappedTaskType,
    ],
  });
};

// Backward compatibility - basic schema without mutations
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
    SwapResultType,
    SwappedTaskType,
  ],
});

// Re-export all types for external usage
export * from "./types/index";
export * from "./model";
export { QueryType } from "./query";
