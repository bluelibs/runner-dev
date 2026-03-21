import React from "react";
import "./styles/docs.scss";
import { hydrateRoot, createRoot } from "react-dom/client";
import { Documentation } from "./components/Documentation";
import {
  Introspector,
  SerializedIntrospector,
} from "../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "./components/Documentation/config/documentationConstants";
import { type DocsPagePayload } from "../../resources/docsPayload";
import {
  getHashTargetElementId,
  getVisibilityStateForHashTarget,
} from "./utils/docsHashVisibility";

// Expect SSR to inject window.__DOCS_PROPS__ with pre-fetched data
declare global {
  interface Window {
    __DOCS_PROPS__?: DocsPagePayload;
    __DOCS_SNAPSHOT_PATH__?: string;
  }
}

// Placeholder token replaced at serve-time in JS by the static router

declare const __API_URL__: string;
const DOCS_DATA_FETCH_TIMEOUT_MS = 15_000;

function createTimedAbortSignal(timeoutMs: number): {
  signal?: AbortSignal;
  cleanup: () => void;
} {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return {
      signal: AbortSignal.timeout(timeoutMs),
      cleanup: () => undefined,
    };
  }

  if (typeof AbortController !== "undefined") {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      cleanup: () => window.clearTimeout(timeoutId),
    };
  }

  return { cleanup: () => undefined };
}

// Use the real Introspector deserializer to avoid exposing runner
function createIntrospectorFromData(data: SerializedIntrospector) {
  return Introspector.deserialize(data);
}

function getShowSystemFromStorage(): boolean {
  try {
    return (
      localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_SYSTEM) ===
      "1"
    );
  } catch {
    return DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_SYSTEM;
  }
}

function setShowSystemInStorage(value: boolean): void {
  try {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_SYSTEM,
      value ? "1" : "0"
    );
  } catch {
    // Ignore storage errors
  }
}

function getShowRunnerFromStorage(): boolean {
  try {
    return (
      localStorage.getItem(DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_RUNNER) ===
      "1"
    );
  } catch {
    return DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_RUNNER;
  }
}

function setShowRunnerInStorage(value: boolean): void {
  try {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_RUNNER,
      value ? "1" : "0"
    );
  } catch {
    // Ignore storage errors
  }
}

function getShowPrivateFromStorage(): boolean {
  try {
    return (
      localStorage.getItem(
        DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE
      ) === "1"
    );
  } catch {
    return DOCUMENTATION_CONSTANTS.DEFAULTS.SHOW_PRIVATE;
  }
}

function setShowPrivateInStorage(value: boolean): void {
  try {
    localStorage.setItem(
      DOCUMENTATION_CONSTANTS.STORAGE_KEYS.SHOW_PRIVATE,
      value ? "1" : "0"
    );
  } catch {
    // Ignore storage errors
  }
}

function ensureVisibilityForHash(introspector: Introspector): void {
  const targetId = getHashTargetElementId(window.location.hash);
  const showSystem = getShowSystemFromStorage();
  const showRunner = getShowRunnerFromStorage();
  const showPrivate = getShowPrivateFromStorage();
  const nextVisibility = getVisibilityStateForHashTarget(
    introspector,
    targetId,
    {
      showSystem,
      showRunner,
      showPrivate,
    }
  );

  if (!showSystem && nextVisibility.showSystem) {
    setShowSystemInStorage(true);
  }
  if (!showRunner && nextVisibility.showRunner) {
    setShowRunnerInStorage(true);
  }
  if (!showPrivate && nextVisibility.showPrivate) {
    setShowPrivateInStorage(true);
  }
}

// Auto-scroll to hash element after render
function scrollToHashElement() {
  const hash = window.location.hash;
  if (!hash) return;

  // Use ID-based lookup to avoid CSS selector semantics (e.g. '.' meaning class)
  const id = decodeURIComponent(hash.slice(1));

  // Use requestAnimationFrame to ensure DOM is fully rendered
  requestAnimationFrame(() => {
    // Add a small delay to ensure complex components are fully mounted
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ block: "start" });
      }
    }, 0);
  });
}

type BootstrapScreenProps = {
  title: string;
  message: string;
  isError?: boolean;
  onRetry?: () => void;
};

function DocsBootstrapScreen({
  title,
  message,
  isError = false,
  onRetry,
}: BootstrapScreenProps) {
  return (
    <div className="docs-bootstrap-screen">
      <div
        className={`docs-bootstrap-card ${
          isError ? "docs-bootstrap-card--error" : ""
        }`}
      >
        {!isError && (
          <div className="docs-bootstrap-spinner" aria-hidden="true" />
        )}
        <h2 className="docs-bootstrap-title">{title}</h2>
        <p className="docs-bootstrap-message">{message}</p>
        {isError && (
          <button
            type="button"
            className="docs-bootstrap-retry"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function renderDocumentation(
  rootTarget: ReturnType<typeof createRoot> | typeof hydrateRoot,
  container: HTMLElement,
  payload: DocsPagePayload,
  hydrate = false
) {
  const introspector = createIntrospectorFromData(
    payload.introspectorData as SerializedIntrospector
  );
  window.__DOCS_PROPS__ = payload;
  ensureVisibilityForHash(introspector);

  const element = React.createElement(Documentation as any, {
    introspector,
    mode: payload.mode,
    namespacePrefix: payload.namespacePrefix,
    runnerFrameworkMd: payload.runnerFrameworkMd,
    runnerDevMd: payload.runnerDevMd,
    docsContent: payload.docsContent,
    projectOverviewMd: payload.projectOverviewMd,
    graphqlSdl: payload.graphqlSdl,
  });

  if (hydrate) {
    hydrateRoot(container, element);
  } else {
    (rootTarget as ReturnType<typeof createRoot>).render(element);
  }

  scrollToHashElement();
}

async function bootstrap() {
  const container = document.getElementById("root")!;
  const props = window.__DOCS_PROPS__;
  if (props && props.introspectorData) {
    renderDocumentation(hydrateRoot as any, container, props, true);
    return;
  }

  const root = createRoot(container);
  root.render(
    <DocsBootstrapScreen
      title="Loading documentation"
      message="Preparing resources, tasks, events, and flow diagrams..."
    />
  );

  const baseUrl = __API_URL__ || "";
  try {
    if (window.__DOCS_SNAPSHOT_PATH__) {
      const response = await fetch(window.__DOCS_SNAPSHOT_PATH__);
      if (!response.ok) {
        throw new Error(`Failed to load docs snapshot (${response.status})`);
      }
      const json = (await response.json()) as DocsPagePayload;
      renderDocumentation(root, container, json);
      return;
    }

    const url = new URL("/docs/data", baseUrl || window.location.origin);
    const { signal, cleanup } = createTimedAbortSignal(
      DOCS_DATA_FETCH_TIMEOUT_MS
    );
    let response: Response;
    try {
      response = await fetch(url.toString(), signal ? { signal } : {});
    } finally {
      cleanup();
    }

    if (!response.ok) {
      throw new Error(`Failed to load docs data (${response.status})`);
    }

    const json = (await response.json()) as DocsPagePayload;
    renderDocumentation(root, container, json);
  } catch (error) {
    console.error("Failed to bootstrap docs UI:", error);
    root.render(
      <DocsBootstrapScreen
        title="Could not load documentation"
        message="The docs endpoint failed to respond. Verify the server is running and reload."
        isError
        onRetry={() => window.location.reload()}
      />
    );
  }
}

bootstrap();
