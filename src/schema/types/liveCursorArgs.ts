import {
  GraphQLFloat,
  GraphQLInt,
  GraphQLNonNull,
  type GraphQLFieldConfigArgumentMap,
} from "graphql";
import type { LiveCursorOptions } from "../../resources/live.resource";

const WINDOW_SEMANTICS =
  "With a cursor (afterSequence or afterTimestamp), `last` returns the oldest N entries after the cursor (page forward); without a cursor, it returns the most recent N.";

/** Cursor and window arguments shared by every live telemetry list field. */
export const liveCursorArgs = {
  afterTimestamp: {
    description: `Exclusive wall-clock cursor (milliseconds since epoch): only entries recorded strictly after it. ${WINDOW_SEMANTICS} Entries sharing one millisecond can straddle a page cut, so page with afterSequence when every entry matters.`,
    type: GraphQLFloat,
  },
  afterSequence: {
    description: `Exclusive sequence cursor: only entries whose \`sequence\` is strictly greater. Pass the last received entry's \`sequence\` to page forward without gaps over the retained entries: each category keeps only its latest maxEntries, and an entry evicted before it is read is skipped without a signal. ${WINDOW_SEMANTICS}`,
    type: GraphQLFloat,
  },
  last: {
    description: `Maximum number of entries. ${WINDOW_SEMANTICS}`,
    type: GraphQLInt,
  },
} satisfies GraphQLFieldConfigArgumentMap;

/** The `sequence` field every live entry type exposes. */
export const liveSequenceField = {
  description:
    "Strictly increasing position of this entry in the live store, shared by logs, emissions, errors and runs and never reused; pass it as `afterSequence` to page forward. An opaque ordering key rather than a count: values are seeded from the wall clock so they keep increasing across process restarts.",
  type: new GraphQLNonNull(GraphQLFloat),
};

interface NullableLiveCursorArgs {
  afterTimestamp?: number | null;
  afterSequence?: number | null;
  last?: number | null;
}

/** Maps GraphQL's nullable cursor arguments onto the store's options. */
export function toLiveCursorOptions(
  args: NullableLiveCursorArgs
): LiveCursorOptions {
  return {
    afterTimestamp: args.afterTimestamp ?? undefined,
    afterSequence: args.afterSequence ?? undefined,
    last: args.last ?? undefined,
  };
}
