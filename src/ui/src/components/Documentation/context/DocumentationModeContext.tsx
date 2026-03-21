import React from "react";
import type { DocumentationMode } from "../../../../../resources/docsPayload";
import { isCatalogDocumentationMode } from "../utils/documentationMode";

const DocumentationModeContext = React.createContext<DocumentationMode>("live");

export function DocumentationModeProvider({
  mode,
  children,
}: {
  mode: DocumentationMode;
  children: React.ReactNode;
}) {
  return (
    <DocumentationModeContext.Provider value={mode}>
      {children}
    </DocumentationModeContext.Provider>
  );
}

export function useDocumentationMode(): DocumentationMode {
  return React.useContext(DocumentationModeContext);
}

export function useIsCatalogDocumentation(): boolean {
  return isCatalogDocumentationMode(useDocumentationMode());
}
