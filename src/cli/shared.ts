import {
  getIntrospectionQuery,
  parse,
  print,
  visit,
  Kind,
  type DocumentNode,
  type FieldNode,
  type ArgumentNode,
  type StringValueNode,
  type ObjectValueNode,
} from "graphql";
import { callGraphQL, toVariables } from "../mcp/http";
import {
  getEndpoint as getEndpointFromEnv,
  parseHeadersFromEnv,
} from "../mcp/env";

export type OutputFormat = "data" | "json" | "pretty";

export interface RemoteExecParams {
  endpoint?: string;
  headersJson?: string;
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export function resolveEndpoint(explicit?: string): string {
  const envEndpoint = getEndpointFromEnv();
  const endpoint = explicit || envEndpoint;
  if (!endpoint) {
    throw new Error(
      "Endpoint not provided. Use --endpoint or set ENDPOINT/GRAPHQL_ENDPOINT."
    );
  }
  return endpoint;
}

export function resolveHeaders(headersJson?: string): Record<string, string> {
  if (headersJson && headersJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(headersJson) as Record<string, unknown>;
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
      return result;
    } catch (e) {
      throw new Error(`Invalid --headers JSON: ${(e as Error).message}`);
    }
  }
  return parseHeadersFromEnv();
}

export async function execRemote(params: RemoteExecParams): Promise<any> {
  const endpoint = resolveEndpoint(params.endpoint);
  // callGraphQL uses env for endpoint; temporarily set for call, then restore
  const prev = process.env.ENDPOINT;
  process.env.ENDPOINT = endpoint;
  // Merge headers via env for callGraphQL
  const prevHeaders = process.env.HEADERS;
  const headers = resolveHeaders(params.headersJson);
  if (Object.keys(headers).length > 0) {
    process.env.HEADERS = JSON.stringify(headers);
  } else {
    delete process.env.HEADERS;
  }
  try {
    return await callGraphQL({
      query: params.query,
      variables: params.variables,
      operationName: params.operationName,
    });
  } finally {
    if (prev != null) process.env.ENDPOINT = prev;
    else delete process.env.ENDPOINT;
    if (prevHeaders != null) process.env.HEADERS = prevHeaders;
    else delete process.env.HEADERS;
  }
}

export function parseVariablesOption(
  input?: string
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  return toVariables(input);
}

export function formatOutput(
  result: any,
  options: { format?: OutputFormat; raw?: boolean }
): string {
  const { format = "data", raw = false } = options;
  if (raw) return JSON.stringify(result, null, 2);
  const data = result?.data ?? null;
  if (format === "json") return JSON.stringify({ data }, null, 2);
  if (format === "pretty") return JSON.stringify(data, null, 2);
  return JSON.stringify(data);
}

export function applyNamespaceFilter(
  query: string,
  namespace?: string
): string {
  if (!namespace || namespace.trim().length === 0) return query;
  let doc: DocumentNode;
  try {
    doc = parse(query);
  } catch {
    return query; // If parsing fails, do not alter the query
  }
  const targets = new Set([
    "tasks",
    "hooks",
    "resources",
    "middlewares",
    "events",
    "taskMiddlewares",
    "resourceMiddlewares",
  ]);
  const nsValue: StringValueNode = { kind: Kind.STRING, value: namespace };

  const updated = visit(doc, {
    Field(node, _key, parent, _path, ancestors) {
      // Only alter top-level selections of an operation
      const parentNode = ancestors[ancestors.length - 1] as any;
      const isTopLevel =
        parentNode &&
        parentNode.kind === Kind.SELECTION_SET &&
        ancestors.length >= 2 &&
        (ancestors[ancestors.length - 2] as any).kind ===
          Kind.OPERATION_DEFINITION;
      if (!isTopLevel) return;
      if (!targets.has(node.name.value)) return;

      // Skip if args already present
      const hasArgs = (node.arguments ?? []).some(
        (a) => a.name.value === "idIncludes" || a.name.value === "filter"
      );
      if (hasArgs) return;

      if (node.name.value === "events") {
        const filterArg: ArgumentNode = {
          kind: Kind.ARGUMENT,
          name: { kind: Kind.NAME, value: "filter" },
          value: {
            kind: Kind.OBJECT,
            fields: [
              {
                kind: Kind.OBJECT_FIELD,
                name: { kind: Kind.NAME, value: "idIncludes" },
                value: nsValue,
              },
            ],
          } as ObjectValueNode,
        };
        const args = [...(node.arguments ?? []), filterArg];
        const updatedNode: FieldNode = { ...node, arguments: args };
        return updatedNode;
      }

      const idArg: ArgumentNode = {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: "idIncludes" },
        value: nsValue,
      };
      const args = [...(node.arguments ?? []), idArg];
      const updatedNode: FieldNode = { ...node, arguments: args };
      return updatedNode;
    },
  });
  return print(updated);
}

export async function fetchIntrospectionJson(
  endpoint?: string,
  headersJson?: string
): Promise<any> {
  const query = getIntrospectionQuery();
  const result = await execRemote({ endpoint, headersJson, query });
  return result;
}
