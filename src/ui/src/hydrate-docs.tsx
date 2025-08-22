import React from "react";
import "./styles/docs.scss";
import { hydrateRoot, createRoot } from "react-dom/client";
import { Documentation } from "./components/Documentation";
import {
  Introspector,
  SerializedIntrospector,
} from "../../resources/models/Introspector";

// Expect SSR to inject window.__DOCS_PROPS__ with pre-fetched data
declare global {
  interface Window {
    __DOCS_PROPS__?: {
      namespacePrefix?: string;
      introspectorData: any;
    };
  }
}

// Placeholder token replaced at serve-time in JS by the static router
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __API_URL__: string;

// Use the real Introspector deserializer to avoid exposing runner
function createIntrospectorFromData(data: SerializedIntrospector) {
  return Introspector.deserialize(data);
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
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  });
}

async function bootstrap() {
  const container = document.getElementById("root")!;
  const props = window.__DOCS_PROPS__;
  if (props && props.introspectorData) {
    const introspector = createIntrospectorFromData(
      props.introspectorData as SerializedIntrospector
    );
    hydrateRoot(
      container,
      React.createElement(Documentation as any, {
        introspector,
        namespacePrefix: props.namespacePrefix,
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
  createRoot(container).render(
    React.createElement(Documentation as any, {
      introspector,
      namespacePrefix: json.namespacePrefix,
    })
  );
  scrollToHashElement();
}

bootstrap();
