import React from "react";
import { renderToString } from "react-dom/server";

export interface ReactSSROptions {
  title?: string;
  meta?: Record<string, string>;
  stylesheets?: string[];
  scripts?: string[];
  inlineScript?: string;
}

export function renderReactToString(
  component: React.ReactElement,
  options: ReactSSROptions = {}
): string {
  const html = renderToString(component);

  const {
    title = "React App",
    meta = {},
    stylesheets = [],
    scripts = [],
    inlineScript,
  } = options;

  const metaTags = Object.entries(meta)
    .map(([name, content]) => `<meta name="${name}" content="${content}">`)
    .join("\n    ");

  const stylesheetLinks = stylesheets
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("\n    ");

  const scriptTags = scripts
    .map((src) => `<script src="${src}"></script>`)
    .join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${metaTags}
    ${stylesheetLinks}
  </head>
  <body>
    <div id="root">${html}</div>
    ${inlineScript ? `<script>${inlineScript}</script>` : ""}
    ${scriptTags}
  </body>
</html>`;
}

export function renderReactComponentOnly(
  component: React.ReactElement
): string {
  return renderToString(component);
}
