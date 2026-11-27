import { useEffect, useState, type RefObject } from "react";
import type { StudioApi } from "../api";
import "../directory.css";

export function WorkflowDirectory({
  api,
  searchRef,
}: {
  api: StudioApi;
  searchRef: RefObject<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");
  return (
    <main className="overview-pane">
      <section className="workflow-directory">
        <header className="overview-head">
          <h1>Workflow catalog</h1>
        </header>
        <input
          ref={searchRef}
          type="search"
          aria-label="Search the workflow catalog"
          placeholder="Search names, keys or descriptions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <CatalogPages key={query} api={api} query={query} />
      </section>
    </main>
  );
}

function CatalogPages({ api, query }: { api: StudioApi; query: string }) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const cursor = cursors.at(-1);
  const [result, setResult] =
    useState<Awaited<ReturnType<StudioApi["listCatalog"]>>>();
  const [error, setError] = useState("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(undefined);
    setError("");
    const timer = window.setTimeout(
      () => {
        void api.listCatalog({ query, cursor }).then(
          (page) => {
            if (active) setResult(page);
          },
          (cause) => {
            if (active)
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Could not load catalog."
              );
          }
        );
      },
      query ? 150 : 0
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, cursor, query, attempt]);
  if (error)
    return (
      <p role="alert">
        {error}{" "}
        <button className="btn ghost small" onClick={() => retry(attempt + 1)}>
          Retry
        </button>
      </p>
    );
  if (!result) return <p role="status">Loading catalog…</p>;
  return (
    <>
      {result.entries.length ? (
        <ul className="directory-entries">
          {result.entries.map((entry) => (
            <li key={JSON.stringify([entry.kind, entry.key, entry.version])}>
              <div className="directory-heading">
                <h2>{entry.title}</h2>
                <span>
                  {entry.kind}
                  {entry.version != null && ` · v${entry.version}`}
                </span>
              </div>
              {entry.description && <p>{entry.description}</p>}
              <code>{entry.key}</code>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {query
            ? "No matching workflows or events."
            : "No workflows or durable events registered for this runtime."}
        </p>
      )}
      <nav aria-label="Catalog pages">
        {cursors.length > 1 && (
          <button
            className="btn ghost small"
            onClick={() => setCursors(cursors.slice(0, -1))}
          >
            Previous page
          </button>
        )}
        {result.nextCursor !== null && (
          <button
            className="btn ghost small"
            onClick={() => setCursors([...cursors, result.nextCursor!])}
          >
            Next page
          </button>
        )}
      </nav>
    </>
  );
}
