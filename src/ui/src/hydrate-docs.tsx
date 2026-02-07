import React from "react";
import "./styles/docs.scss";
import { hydrateRoot, createRoot } from "react-dom/client";
import { Documentation } from "./components/Documentation";
import {
  Introspector,
  SerializedIntrospector,
} from "../../resources/models/Introspector";
import { DOCUMENTATION_CONSTANTS } from "./components/Documentation/config/documentationConstants";

// Expect SSR to inject window.__DOCS_PROPS__ with pre-fetched data
declare global {
  interface Window {
    __DOCS_PROPS__?: {
      namespacePrefix?: string;
      introspectorData: any;
      runnerFrameworkMd?: string;
      runnerDevMd?: string;
      projectOverviewMd?: string;
      graphqlSdl?: string;
    };
  }
}

// Placeholder token replaced at serve-time in JS by the static router

declare const __API_URL__: string;

// Use the real Introspector deserializer to avoid exposing runner
function createIntrospectorFromData(data: SerializedIntrospector) {
  return Introspector.deserialize(data);
}

// If the URL hash targets a system-tagged element and system is hidden,
// enable system visibility before rendering so the element is present.
function getHashTargetElementId(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const id = decodeURIComponent(hash.slice(1));
  if (!id) return null;
  if (id.startsWith("element-")) return id.slice("element-".length);
  return id;
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

function isSystemElementById(
  introspector: Introspector,
  elementId: string
): boolean {
  const systemTagId = DOCUMENTATION_CONSTANTS.SYSTEM_TAG_ID;
  if (elementId === systemTagId) return true;

  const candidates: Array<any | null> = [
    introspector.getTask(elementId),
    introspector.getHook(elementId),
    introspector.getResource(elementId),
    introspector.getMiddleware(elementId),
    introspector.getEvent(elementId),
  ];

  for (const el of candidates) {
    if (el && Array.isArray((el as any).tags)) {
      if ((el as any).tags.includes(systemTagId)) return true;
    }
  }
  return false;
}

function ensureSystemVisibilityForHash(introspector: Introspector): void {
  const targetId = getHashTargetElementId();
  if (!targetId) return;
  const showSystem = getShowSystemFromStorage();
  if (!showSystem && isSystemElementById(introspector, targetId)) {
    setShowSystemInStorage(true);
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

async function bootstrap() {
  const container = document.getElementById("root")!;
  const props = window.__DOCS_PROPS__;
  if (props && props.introspectorData) {
    const introspector = createIntrospectorFromData(
      props.introspectorData as SerializedIntrospector
    );
    ensureSystemVisibilityForHash(introspector);
    hydrateRoot(
      container,
      React.createElement(Documentation as any, {
        introspector,
        namespacePrefix: props.namespacePrefix,
        runnerFrameworkMd: props.runnerFrameworkMd,
        runnerDevMd: props.runnerDevMd,
        projectOverviewMd: props.projectOverviewMd,
        graphqlSdl: props.graphqlSdl,
      })
    );
    scrollToHashElement();
    return;
  }

  const baseUrl = __API_URL__ || "";
  const url = new URL("/docs/data", baseUrl || window.location.origin);
  const response = await fetch(url.toString());
  const json = await response.json();
  const introspector = createIntrospectorFromData(
    json.introspectorData as SerializedIntrospector
  );
  ensureSystemVisibilityForHash(introspector);
  createRoot(container).render(
    React.createElement(Documentation as any, {
      introspector,
      namespacePrefix: json.namespacePrefix,
      runnerFrameworkMd: json.runnerFrameworkMd,
      runnerDevMd: json.runnerDevMd,
      projectOverviewMd: json.projectOverviewMd,
      graphqlSdl: json.graphqlSdl,
    })
  );
  scrollToHashElement();
}

bootstrap();
