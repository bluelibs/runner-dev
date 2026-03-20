import type { DocumentationMode } from "../../../../../resources/docsPayload";

declare global {
  interface Window {
    __DOCS_PROPS__?: {
      mode?: DocumentationMode;
    };
  }
}

export function getWindowDocumentationMode(): DocumentationMode {
  if (typeof window === "undefined") {
    return "live";
  }

  return window.__DOCS_PROPS__?.mode === "catalog" ? "catalog" : "live";
}

export function isCatalogDocumentationMode(
  mode?: DocumentationMode | null
): boolean {
  return (mode ?? getWindowDocumentationMode()) === "catalog";
}
