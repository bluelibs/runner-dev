import { useEffect, useMemo, useState } from "react";
import type { DurableRuntimeDescriptor } from "../../../durable/shared/runtime";
import { App } from "./App";
import { createLiveApi } from "./api";

export function RuntimeDashboard() {
  const [runtimes, setRuntimes] = useState<DurableRuntimeDescriptor[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/durable/api/runtimes", {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(`Could not load runtimes (${response.status}).`);
        const payload: { runtimes: DurableRuntimeDescriptor[] } =
          await response.json();
        if (controller.signal.aborted) return;
        setRuntimes(payload.runtimes);
        const requested = new URLSearchParams(window.location.search).get(
          "runtimeId"
        );
        setSelected(
          payload.runtimes.find((item) => item.id === requested)?.id ??
            payload.runtimes[0]?.id ??
            ""
        );
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not load runtimes."
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  const api = useMemo(() => createLiveApi(selected), [selected]);
  const runtime = runtimes.find((item) => item.id === selected);
  function selectRuntime(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("runtimeId", id);
    url.searchParams.delete("select");
    url.searchParams.delete("modal");
    window.history.replaceState(null, "", url);
    setSelected(id);
  }
  if (loading || error || !runtime) {
    return (
      <main className="runtime-empty">
        <a className="runtime-back" href="/docs">
          ← Runner Dev
        </a>
        <div className="runtime-empty-content">
          <span className="runtime-eyebrow">Durable Workflows</span>
          <h1>
            {loading
              ? "Connecting to your workflows"
              : error
              ? "Runtime unavailable"
              : "Ready when your workflows are"}
          </h1>
          <p>
            {loading
              ? "Discovering the durable runtimes in your application…"
              : error ||
                "No durable runtime is registered in this application. Once one is running, its executions will appear here."}
          </p>
          {error ? (
            <button
              className="btn primary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Retry connection
            </button>
          ) : null}
          <a className="btn ghost" href="/docs">
            Open documentation
          </a>
        </div>
      </main>
    );
  }
  return (
    <>
      <header className="runtime-bar">
        <a href="/docs" className="runtime-back">
          ← Runner Dev
        </a>
        <div className="runtime-picker">
          <span className="conn-dot" />
          <label htmlFor="durable-runtime">Runtime</label>
          <select
            id="durable-runtime"
            value={selected}
            onChange={(event) => selectRuntime(event.target.value)}
          >
            {runtimes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <span className="runtime-live">LIVE APPLICATION</span>
      </header>
      <App key={selected} api={api} runtime={runtime} />
    </>
  );
}
