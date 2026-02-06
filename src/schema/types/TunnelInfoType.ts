import {
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";

import { TaskType } from "./TaskType";
import { EventType } from "./EventType";

export const TunnelModeEnum = new GraphQLEnumType({
  name: "TunnelMode",
  description: "Tunnel operation mode",
  values: {
    client: { value: "client" },
    server: { value: "server" },
    both: { value: "both" },
  },
});

export const TunnelTransportEnum = new GraphQLEnumType({
  name: "TunnelTransport",
  description: "Tunnel transport mechanism",
  values: {
    http: { value: "http" },
    other: { value: "other" },
  },
});

export const TunnelEventDeliveryModeEnum = new GraphQLEnumType({
  name: "TunnelEventDeliveryMode",
  description: "How events are delivered between local and remote runtimes",
  values: {
    local_only: { value: "local-only" },
    remote_only: { value: "remote-only" },
    remote_first: { value: "remote-first" },
    mirror: { value: "mirror" },
  },
});

export const TunnelInfoType = new GraphQLObjectType({
  name: "TunnelInfo",
  description: "Tunnel configuration and routing information",
  fields: {
    mode: {
      description: "Tunnel operation mode",
      type: new GraphQLNonNull(TunnelModeEnum),
    },
    transport: {
      description: "Transport mechanism used by the tunnel",
      type: new GraphQLNonNull(TunnelTransportEnum),
    },
    tasks: {
      description: "Task IDs tunneled through this resource",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    tasksResolved: {
      description: "Tasks tunneled through this resource (resolved)",
      type: new GraphQLList(new GraphQLNonNull(TaskType)),
      resolve: (tunnelInfo, _args, ctx) => {
        if (!tunnelInfo.tasks) return [];
        return ctx.introspector.getTasksByIds(tunnelInfo.tasks);
      },
    },
    events: {
      description: "Event IDs tunneled through this resource",
      type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
    },
    eventsResolved: {
      description: "Events tunneled through this resource (resolved)",
      type: new GraphQLList(new GraphQLNonNull(EventType)),
      resolve: (tunnelInfo, _args, ctx) => {
        if (!tunnelInfo.events) return [];
        return ctx.introspector.getEventsByIds(tunnelInfo.events);
      },
    },
    endpoint: {
      description: "Remote endpoint URL (for client tunnels)",
      type: GraphQLString,
    },
    auth: {
      description: "Authentication method used by the tunnel",
      type: GraphQLString,
    },
    eventDeliveryMode: {
      description: "How events are delivered between local and remote runtimes",
      type: TunnelEventDeliveryModeEnum,
    },
  },
});
