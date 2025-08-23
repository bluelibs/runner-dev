import {
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  type GraphQLFieldConfigMap,
  GraphQLList,
} from "graphql";
import { All, elementKindSymbol, ElementKind } from "../model";
import { sanitizePath } from "../../utils/path";
import { MetaType } from "./MetaType";
import { baseElementCommonFields } from "./BaseElementCommon";
import { TagType, TagUsageType } from "./TagType";

export const BaseElementInterface: GraphQLInterfaceType =
  new GraphQLInterfaceType({
    name: "BaseElement",
    description: "Common fields for all runner elements",
    fields: (): GraphQLFieldConfigMap<any, any> => ({
      id: {
        description: "Stable identifier",
        type: new GraphQLNonNull(GraphQLID),
      },
      meta: {
        description: "Optional metadata (title, description, tags)",
        type: MetaType,
      },
      filePath: {
        description: "Source file path when available",
        type: GraphQLString,
      },
      fileContents: {
        description:
          "Contents of the file at filePath (if accessible). Optionally slice by 1-based inclusive line numbers via startLine/endLine.",
        type: GraphQLString,
        args: {
          startLine: {
            description: "1-based inclusive start line",
            type: GraphQLInt,
          },
          endLine: {
            description: "1-based inclusive end line",
            type: GraphQLInt,
          },
        },
      },
      markdownDescription: {
        description:
          "Markdown composed from meta.title and meta.description (if present)",
        type: new GraphQLNonNull(GraphQLString),
      },
      tags: {
        description: "Tags associated with this element",
        type: new GraphQLList(new GraphQLNonNull(TagType)),
      },
      tagsDetailed: {
        description: "Detailed tags associated with this element",
        type: new GraphQLList(new GraphQLNonNull(TagUsageType)),
      },
    }),
    resolveType: (value: any) => {
      const kind = (value && (value as any)[elementKindSymbol]) as
        | undefined
        | "TASK"
        | "HOOK"
        | "RESOURCE"
        | "MIDDLEWARE"
        | "EVENT";
      switch (kind) {
        case "TASK":
          return "Task";
        case "HOOK":
          return "Hook";
        case "RESOURCE":
          return "Resource";
        case "MIDDLEWARE": {
          // Decide specific middleware type based on usage shape
          const usedByTasks = Array.isArray((value as any)?.usedByTasks)
            ? ((value as any)?.usedByTasks as unknown[])
            : [];
          const usedByResources = Array.isArray((value as any)?.usedByResources)
            ? ((value as any)?.usedByResources as unknown[])
            : [];
          if (usedByTasks.length > 0 || usedByResources.length === 0) {
            return "TaskMiddleware";
          }
          return "ResourceMiddleware";
        }
        case "EVENT":
          return "Event";
        default:
          break;
      }
      // Fallback to structural checks if no stamp present
      if (Array.isArray(value?.registers) && Array.isArray(value?.overrides)) {
        return "Resource";
      }
      if (
        Array.isArray(value?.usedByTasks) ||
        Array.isArray(value?.usedByResources)
      ) {
        const usedByTasks = Array.isArray((value as any)?.usedByTasks)
          ? ((value as any)?.usedByTasks as unknown[])
          : [];
        const usedByResources = Array.isArray((value as any)?.usedByResources)
          ? ((value as any)?.usedByResources as unknown[])
          : [];
        if (usedByTasks.length > 0 || usedByResources.length === 0) {
          return "TaskMiddleware";
        }
        return "ResourceMiddleware";
      }
      if (Array.isArray(value?.listenedToBy)) {
        return "Event";
      }
      if (Array.isArray(value?.events)) {
        return "Hook";
      }
      if (Array.isArray(value?.emits) && Array.isArray(value?.dependsOn)) {
        return "Task";
      }
      return "All";
    },
  });

export const AllType: GraphQLObjectType = new GraphQLObjectType({
  name: "All",
  description:
    "Minimal, generic element used for root and as a fallback when a specific concrete type cannot be resolved.",
  interfaces: [BaseElementInterface],
  isTypeOf: (value) => {
    // Only use All type as fallback when no specific type can be determined
    const kind = (value && (value as any)[elementKindSymbol]) as
      | ElementKind
      | undefined;

    // If it has a kind symbol, it should resolve to a specific type, not All
    if (
      kind === "TASK" ||
      kind === "HOOK" ||
      kind === "RESOURCE" ||
      kind === "MIDDLEWARE" ||
      kind === "EVENT"
    ) {
      return false;
    }

    // Structural checks - if it matches a specific type, don't use All
    if (Array.isArray(value?.registers) && Array.isArray(value?.overrides)) {
      return false; // Resource
    }
    if (
      Array.isArray(value?.usedByTasks) &&
      Array.isArray(value?.usedByResources)
    ) {
      return false; // Middleware
    }
    if (Array.isArray(value?.listenedToBy)) {
      return false; // Event
    }
    if (Array.isArray(value?.events)) {
      return false; // Hook
    }
    if (Array.isArray(value?.emits) && Array.isArray(value?.dependsOn)) {
      return false; // Task
    }

    // Only use All type for objects that truly can't be resolved to a specific type
    return typeof (value as any)?.id === "string";
  },
  fields: (): GraphQLFieldConfigMap<any, any> => ({
    id: {
      description: "Element ID",
      type: new GraphQLNonNull(GraphQLID),
    },
    meta: { description: "Element metadata", type: MetaType },
    filePath: {
      description: "Path to element file",
      type: GraphQLString,
      resolve: (node: any) => sanitizePath(node?.filePath ?? null),
    },
    ...baseElementCommonFields(),
  }),
});
