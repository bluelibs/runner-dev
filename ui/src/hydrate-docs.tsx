import React from "react";
import { hydrateRoot } from "react-dom/client";
import { Documentation } from "./Documentation";

// Expect SSR to inject window.__DOCS_PROPS__ with pre-fetched data
declare global {
  interface Window {
    __DOCS_PROPS__?: {
      namespacePrefix?: string;
      introspectorData: any;
    };
  }
}

// A minimal wrapper that reconstructs an introspector-like object from data
function createIntrospectorFromData(data: any) {
  return {
    getTasks: () => data.tasks ?? [],
    getResources: () => data.resources ?? [],
    getEvents: () => data.events ?? [],
    getHooks: () => data.hooks ?? [],
    getMiddlewares: () => data.middlewares ?? [],
    getAllTags: () => data.tags ?? [],
    getDiagnostics: () => data.diagnostics ?? [],
    getOrphanEvents: () => data.orphanEvents ?? [],
    getUnemittedEvents: () => data.unemittedEvents ?? [],
    getUnusedMiddleware: () => data.unusedMiddleware ?? [],
    getMissingFiles: () => data.missingFiles ?? [],
    getOverrideConflicts: () => data.overrideConflicts ?? [],
  };
}

const props = window.__DOCS_PROPS__ ?? { introspectorData: {} };
const introspector = createIntrospectorFromData(props.introspectorData);

hydrateRoot(
  document.getElementById("root")!,
  React.createElement(Documentation as any, {
    introspector,
    namespacePrefix: props.namespacePrefix,
  })
);
