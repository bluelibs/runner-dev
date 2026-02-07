export const ENDPOINT = process.env.ENDPOINT || process.env.GRAPHQL_ENDPOINT;

export const ALLOW_MUTATIONS =
  (process.env.ALLOW_MUTATIONS || "").toLowerCase() === "true";

export function parseHeadersFromEnv(): Record<string, string> {
  const headersEnv = process.env.HEADERS;
  if (!headersEnv) return {};
  try {
    const parsed = JSON.parse(headersEnv) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        result[key] = value;
      } else {
        result[key] = JSON.stringify(value);
      }
    }
    return result;
  } catch (e) {
    console.warn("HEADERS env var is not valid JSON. Ignoring. Error:", e);
    return {};
  }
}

export function getEndpoint(): string | undefined {
  return process.env.ENDPOINT || process.env.GRAPHQL_ENDPOINT;
}

export function assertEndpoint(): string {
  const endpoint = getEndpoint();
  if (!endpoint) {
    throw new Error(
      "ENDPOINT env variable is required to use the GraphQL MCP server"
    );
  }
  return endpoint;
}
