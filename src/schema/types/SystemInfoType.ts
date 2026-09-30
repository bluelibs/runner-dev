import {
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import * as os from "node:os";

export interface SystemInfo {
  platform: string;
  architecture: string;
  cpuModel: string;
  logicalCores: number;
  totalMemory: number;
  nodeVersion: string;
}

export function getSystemInfo(): SystemInfo {
  const cpus = os.cpus();
  return {
    platform: os.type(),
    architecture: os.arch(),
    cpuModel: cpus[0]?.model?.trim() || "Unknown CPU",
    logicalCores: cpus.length,
    totalMemory: os.totalmem(),
    nodeVersion: process.version,
  };
}

export const SystemInfoType = new GraphQLObjectType<SystemInfo>({
  name: "SystemInfo",
  description: "Host information for the process serving Runner DevTools",
  fields: {
    platform: { type: new GraphQLNonNull(GraphQLString) },
    architecture: { type: new GraphQLNonNull(GraphQLString) },
    cpuModel: { type: new GraphQLNonNull(GraphQLString) },
    logicalCores: { type: new GraphQLNonNull(GraphQLInt) },
    totalMemory: {
      description: "Host RAM in bytes",
      type: new GraphQLNonNull(GraphQLFloat),
    },
    nodeVersion: { type: new GraphQLNonNull(GraphQLString) },
  },
});
