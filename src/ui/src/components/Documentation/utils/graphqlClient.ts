/* Minimal GraphQL client for the docs UI */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __API_URL__: string;

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

function getBaseUrl(): string {
  // __API_URL__ is replaced at serve-time, fallback to window origin
  try {
    const base: string = __API_URL__;
    if (base && typeof base === "string" && base.length > 0) return base;
  } catch {}
  return typeof window !== "undefined" ? window.location.origin : "";
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const endpoint = new URL("/graphql", getBaseUrl()).toString();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as GraphQLResponse<T>;
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}`);
  }
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join("\n"));
  }
  return json.data as T;
}

// Sample queries (usage example)
export const SAMPLE_TASK_FILE_QUERY = `
  query TaskFile($id: ID!, $startLine: Int, $endLine: Int) {
    task(id: $id) {
      id
      filePath
      fileContents(startLine: $startLine, endLine: $endLine)
    }
  }
`;

export const SAMPLE_RESOURCE_FILE_QUERY = `
  query ResourceFile($id: ID!, $startLine: Int, $endLine: Int) {
    resource(id: $id) {
      id
      filePath
      fileContents(startLine: $startLine, endLine: $endLine)
    }
  }
`;

export const SAMPLE_MIDDLEWARE_FILE_QUERY = `
  query MiddlewareFile($id: ID!, $startLine: Int, $endLine: Int) {
    middleware(id: $id) {
      id
      filePath
      fileContents(startLine: $startLine, endLine: $endLine)
    }
  }
`;

export const SAMPLE_EVENT_FILE_QUERY = `
  query EventFile($id: ID!, $startLine: Int, $endLine: Int) {
    event(id: $id) {
      id
      filePath
      fileContents(startLine: $startLine, endLine: $endLine)
    }
  }
`;
