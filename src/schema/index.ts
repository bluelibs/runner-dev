import { GraphQLSchema } from "graphql";
import { QueryType } from "./query";
import { MutationType } from "./mutation";
import type { ISwapManager } from "../resources/swap.resource";
import {
  AllType,
  BaseElementInterface,
  EventType,
  HookType,
  MiddlewareGlobalType,
  MiddlewareType,
  TaskMiddlewareType,
  ResourceMiddlewareType,
  MetaType,
  ResourceType,
  TaskType,
  LiveType,
  DiagnosticType,
  SwapResultType,
  SwappedTaskType,
  ErrorType,
  AsyncContextType,
  TunnelInfoType,
  TunnelModeEnum,
  TunnelTransportEnum,
} from "./types/index";

export const createSchema = (swapManager?: ISwapManager) => {
  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
    types: [
      AllType,
      BaseElementInterface,
      EventType,
      HookType,
      MiddlewareGlobalType,
      MiddlewareType,
      TaskMiddlewareType,
      ResourceMiddlewareType,
      MetaType,
      ResourceType,
      TaskType,
      LiveType,
      DiagnosticType,
      SwapResultType,
      SwappedTaskType,
      ErrorType,
      AsyncContextType,
      TunnelInfoType,
      TunnelModeEnum,
      TunnelTransportEnum,
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
    HookType,
    MiddlewareGlobalType,
    MiddlewareType,
    TaskMiddlewareType,
    ResourceMiddlewareType,
    MetaType,
    ResourceType,
    TaskType,
    LiveType,
    DiagnosticType,
    SwapResultType,
    SwappedTaskType,
    ErrorType,
    AsyncContextType,
    TunnelInfoType,
    TunnelModeEnum,
    TunnelTransportEnum,
  ],
});

// Re-export all types for external usage
export * from "./types/index";
export * from "./model";
export { QueryType } from "./query";
