export const ENDPOINT = process.env.ENDPOINT || process.env.GRAPHQL_ENDPOINT;
export const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE;

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

export function getSnapshotFile(): string | undefined {
  return process.env.SNAPSHOT_FILE;
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

export function assertSnapshotFile(): string {
  const snapshotFile = getSnapshotFile();
  if (!snapshotFile) {
    throw new Error(
      "SNAPSHOT_FILE env variable is required to use the snapshot-backed MCP server"
    );
  }
  return snapshotFile;
}

export function getGraphqlSourceDescription(): string | undefined {
  const snapshotFile = getSnapshotFile();
  if (snapshotFile) {
    return `snapshot:${snapshotFile}`;
  }

  return getEndpoint();
}

export function assertGraphqlSourceDescription(): string {
  const source = getGraphqlSourceDescription();
  if (!source) {
    throw new Error(
      "Set ENDPOINT/GRAPHQL_ENDPOINT for a live server or SNAPSHOT_FILE for an exported snapshot."
    );
  }
  return source;
}
