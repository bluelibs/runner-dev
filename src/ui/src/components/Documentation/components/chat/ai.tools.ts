import { RegisteredTool } from "./ai.service";
import { fetchElementFileContentsBySearch } from "../../utils/fileContentUtils";
import { graphqlRequest } from "../../utils/graphqlClient";
import { ChatState } from "./ChatTypes";

export const createTools = (
  _getChatState: () => ChatState,
  _setChatState: React.Dispatch<React.SetStateAction<ChatState>>
): RegisteredTool[] => [
  {
    name: "get_current_time",
    description: "Returns the current ISO timestamp.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => ({ now: new Date().toISOString() }),
  },
  {
    name: "get_file_contents_by_element_ids",
    description:
      "Fetch file contents for multiple elements using an array of element ids. Uses universal search to find elements reliably. Returns array in the same order.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    run: async (args: any) => {
      const a = args as { items: string[] };

      const sanitize = (s: string) => (s.startsWith("@") ? s.slice(1) : s);

      const fetchBySearch = async (
        raw: string
      ): Promise<{
        id: string;
        filePath: string | null;
        fileContents: string | null;
      } | null> => {
        const elementId = sanitize(raw);

        // Use universal search - much more reliable!
        const result = await fetchElementFileContentsBySearch(elementId);
        return result;
      };

      const results = await Promise.all(a.items.map((s) => fetchBySearch(s)));
      return results.map(
        (r, idx) =>
          r ?? { id: a.items[idx], filePath: null, fileContents: null }
      );
    },
  },
  {
    name: "graphql_query",
    description: [
      "Execute a GraphQL query against the app's /graphql endpoint.",
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        variables: {
          oneOf: [{ type: "string" }, { type: "object" }],
        },
        operationName: { type: "string" },
        maxItems: { type: "integer", minimum: 1, maximum: 100 },
        title: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    run: async (rawArgs: unknown) => {
      const args = (rawArgs || {}) as {
        query: string;
        variables?: unknown;
        operationName?: string;
        format?: "json" | "markdown";
        markdownStyle?: "summary" | "story";
        maxItems?: number;
        title?: string;
      };

      if (!args.query || typeof args.query !== "string") {
        return { error: "Missing 'query' string" };
      }

      let variables: Record<string, unknown> | undefined = undefined;
      if (typeof args.variables === "string") {
        try {
          variables = JSON.parse(args.variables) as Record<string, unknown>;
        } catch {
          return { error: "Invalid JSON in 'variables'" };
        }
      } else if (
        args.variables &&
        typeof args.variables === "object" &&
        !Array.isArray(args.variables)
      ) {
        variables = args.variables as Record<string, unknown>;
      }

      const data = await graphqlRequest<unknown>(args.query, variables);

      return { data };
    },
  },
];
