import { assertEndpoint, parseHeadersFromEnv } from "./env";

export async function callGraphQL(params: {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}): Promise<unknown> {
  const endpoint = assertEndpoint();
  const headers = {
    "content-type": "application/json",
    ...parseHeadersFromEnv(),
  };
  const body: Record<string, unknown> = { query: params.query };
  if (params.variables) body.variables = params.variables;
  if (params.operationName) body.operationName = params.operationName;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GraphQL HTTP error ${res.status}: ${text}`);
  }

  return (await res.json()) as unknown;
}

export function toVariables(
  input: unknown
): Record<string, unknown> | undefined {
  if (input == null) return undefined;
  if (typeof input === "string" && input.trim().length > 0) {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch (e) {
      throw new Error(
        `Failed to parse variables JSON: ${(e as Error).message}`
      );
    }
  }
  if (typeof input === "object") {
    return input as Record<string, unknown>;
  }
  return undefined;
}
