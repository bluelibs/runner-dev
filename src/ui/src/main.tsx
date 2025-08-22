import React from "react";
import { createRoot } from "react-dom/client";
import { Documentation } from "./components/Documentation";

createRoot(document.getElementById("root")!).render(
  React.createElement(Documentation as any, {
    introspector: {
      getTasks: () => [],
      getResources: () => [],
      getEvents: () => [],
      getHooks: () => [],
      getMiddlewares: () => [],
      getAllTags: () => [],
      getDiagnostics: () => [],
      getOrphanEvents: () => [],
      getUnemittedEvents: () => [],
      getUnusedMiddleware: () => [],
      getMissingFiles: () => [],
      getOverrideConflicts: () => [],
    },
  })
);
