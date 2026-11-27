import { combineErrorRecords } from "../../resources/live/errorLogEntries";
import { historySearch } from "../../resources/live/searchHistory";
import {
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import type { CustomGraphQLContext } from "../context";
import { groupErrors, type ErrorGroup } from "../../resources/live/errorGroups";
import type { ErrorEntry } from "../../resources/live/types";

export function errorGroupsField(
  entryType: GraphQLObjectType<ErrorEntry, CustomGraphQLContext>
) {
  const groupType = new GraphQLObjectType<ErrorGroup, CustomGraphQLContext>({
    name: "LiveErrorGroup",
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      latest: { type: new GraphQLNonNull(entryType) },
      firstSeenMs: { type: new GraphQLNonNull(GraphQLFloat) },
      lastSeenMs: { type: new GraphQLNonNull(GraphQLFloat) },
      count: {
        type: new GraphQLNonNull(GraphQLInt),
        resolve: (group) => group.occurrences.length,
      },
      occurrences: {
        description:
          "Retained occurrences in descending sequence order. Omit last for the whole group.",
        type: new GraphQLNonNull(
          new GraphQLList(new GraphQLNonNull(entryType))
        ),
        args: { last: { type: GraphQLInt } },
        resolve: (group, { last }) =>
          last == null
            ? group.occurrences
            : group.occurrences.slice(0, Math.max(0, last)),
      },
    },
  });
  return {
    description:
      "Errors grouped across retained live history, newest recorded group first.",
    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(groupType))),
    args: { id: { type: GraphQLID }, search: { type: GraphQLString } },
    resolve: (
      _root: unknown,
      args: { id?: string | null; search?: string | null },
      ctx: CustomGraphQLContext
    ) => {
      const logs = ctx.live.getLogs({ levels: ["error", "critical", "fatal"] });
      const { entries, pairedLogs } = combineErrorRecords(
        ctx.live.getErrors(),
        logs
      );
      const groups = groupErrors(entries, args.id);
      const matches = historySearch(args.search);
      if (!matches) return groups;
      return groups.filter((group) =>
        group.occurrences.some((entry) => {
          const log = pairedLogs.get(entry);
          return matches(entry) || (log && matches(log));
        })
      );
    },
  };
}
