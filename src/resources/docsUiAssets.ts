import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export interface DocsBuildEntry {
  file: string;
  css?: string[];
}

export interface DocsBuildAssets {
  uiDir: string;
  entry: DocsBuildEntry;
}

export interface DocsUiRuntimeConfig {
  apiUrl?: string;
}

export interface StandaloneDocsHtmlOptions {
  uiDir: string;
  entry: DocsBuildEntry;
  payload: unknown;
  title?: string;
}

function normalizeAssetHref(prefix: string, assetPath: string): string {
  const cleanPrefix = prefix.length > 0 ? `${prefix.replace(/\/+$/, "")}/` : "";

  return `${cleanPrefix}${assetPath.replace(/^\/+/, "")}`;
}

export function renderDocsHtml(
  entry: DocsBuildEntry,
  options?: {
    assetPrefix?: string;
    faviconHref?: string;
    snapshotPath?: string;
  }
): string {
  const assetPrefix = options?.assetPrefix ?? "/";
  const faviconHref = options?.faviconHref ?? "/docs/favicon.ico";
  const stylesheetHrefs = Array.isArray(entry.css)
    ? entry.css.map((href) => normalizeAssetHref(assetPrefix, href))
    : [];
  const moduleScriptHref = normalizeAssetHref(assetPrefix, entry.file);

  const styles = stylesheetHrefs
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join("");
  const snapshotPath = options?.snapshotPath;
  const moduleBootstrap = (() => {
    const bootstrapData = JSON.stringify({
      snapshotPath,
      moduleScriptHref,
    });

    return `<script>(function(){var config=${bootstrapData};if(window.location.protocol==="file:"){document.body.innerHTML='<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;background:#0f172a;color:#e2e8f0;font-family:ui-sans-serif,system-ui,sans-serif;"><div style="max-width:720px;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px;box-shadow:0 24px 60px rgba(15,23,42,0.35);"><div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#93c5fd;margin-bottom:12px;">Runner-Dev Docs</div><h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">This page expects the Runner-Dev server</h1><p style="margin:0;line-height:1.6;color:#cbd5e1;">The live docs shell uses browser modules and runtime endpoints, so open it through the running Runner-Dev server instead of <code style="background:#0f172a;padding:2px 6px;border-radius:6px;color:#f8fafc;">file://</code>.</p></div></div>';return;}if(config.snapshotPath){window.__DOCS_SNAPSHOT_PATH__=config.snapshotPath;}var script=document.createElement("script");script.type="module";script.src=config.moduleScriptHref;document.body.appendChild(script);})();</script>`;
  })();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Runner Dev Docs</title><link rel="icon" href="${faviconHref}" type="image/x-icon"/>${styles}</head><body><div id="root"></div>${moduleBootstrap}</body></html>`;
}

export function applyDocsUiRuntimeReplacements(
  source: string,
  config: DocsUiRuntimeConfig = {}
): string {
  const replacements: [string, string][] = [
    ["__API_URL__", config.apiUrl ?? ""],
  ];

  let transformed = source;
  for (const [token, value] of replacements) {
    transformed = transformed.split(token).join(JSON.stringify(value));
  }

  return transformed;
}

function escapeInlineScriptContent(value: string): string {
  return value.replace(/<\/script/gi, "<\\/script");
}

function escapeJsonForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function getInlineFaviconHref(uiDir: string): Promise<string | null> {
  const faviconPath = path.join(uiDir, "docs", "favicon.ico");
  try {
    const buffer = await fsp.readFile(faviconPath);
    return `data:image/x-icon;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderStandaloneDocsHtml(
  options: StandaloneDocsHtmlOptions
): Promise<string> {
  const [cssSources, jsSource, faviconHref] = await Promise.all([
    Promise.all(
      (options.entry.css ?? []).map((href) =>
        fsp.readFile(path.join(options.uiDir, href), "utf8")
      )
    ),
    fsp.readFile(path.join(options.uiDir, options.entry.file), "utf8"),
    getInlineFaviconHref(options.uiDir),
  ]);

  const css = cssSources.join("\n");
  const js = escapeInlineScriptContent(
    applyDocsUiRuntimeReplacements(jsSource, { apiUrl: "" }).replace(
      /\n\/\/# sourceMappingURL=.*$/u,
      ""
    )
  );
  const payloadJson = escapeJsonForInlineScript(options.payload);
  const title = options.title ?? "Runner Dev Docs";
  const faviconTag = faviconHref
    ? `<link rel="icon" href="${faviconHref}" type="image/x-icon"/>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title>${faviconTag}<style>${css}</style></head><body><div id="root"></div><script>window.__DOCS_PROPS__=${payloadJson};</script><script type="module">${js}</script></body></html>`;
}

export async function copyDocsUiAssetsForExport(
  sourceDir: string,
  targetDir: string,
  runtimeConfig: DocsUiRuntimeConfig = {}
): Promise<void> {
  await fsp.mkdir(targetDir, { recursive: true });
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDocsUiAssetsForExport(sourcePath, targetPath, runtimeConfig);
      continue;
    }

    if (entry.isFile() && path.extname(entry.name) === ".js") {
      const content = await fsp.readFile(sourcePath, "utf8");
      await fsp.writeFile(
        targetPath,
        applyDocsUiRuntimeReplacements(content, runtimeConfig),
        "utf8"
      );
      continue;
    }

    await fsp.copyFile(sourcePath, targetPath);
  }
}

export async function readDocsBuildEntry(
  uiDir: string
): Promise<DocsBuildEntry> {
  let manifestRaw: string | undefined;
  const manifestPathVite = path.resolve(uiDir, ".vite/manifest.json");
  try {
    manifestRaw = await fsp.readFile(manifestPathVite, "utf8");
  } catch {
    /* fallback below */
  }

  if (!manifestRaw) {
    const manifestPath = path.resolve(uiDir, "manifest.json");
    manifestRaw = await fsp.readFile(manifestPath, "utf8");
  }

  const manifest = JSON.parse(manifestRaw);
  let entry = manifest["docs"] || manifest["src/hydrate-docs.tsx"];
  if (!entry) {
    entry = Object.values(manifest).find((item: any) => item && item.isEntry);
  }

  if (!entry?.file) {
    throw new Error(
      `Docs UI manifest in '${uiDir}' does not contain a valid docs entry.`
    );
  }

  return {
    file: String(entry.file),
    css: Array.isArray(entry.css)
      ? entry.css.map((href: unknown) => String(href))
      : [],
  };
}

export async function resolveDocsBuildAssets(): Promise<DocsBuildAssets> {
  const candidateUiDirs = [path.resolve(__dirname, "../../dist/ui")];

  const failures: string[] = [];

  for (const uiDir of candidateUiDirs) {
    if (!fs.existsSync(uiDir)) {
      failures.push(`${uiDir} (missing)`);
      continue;
    }

    try {
      return {
        uiDir,
        entry: await readDocsBuildEntry(uiDir),
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown manifest error";
      failures.push(`${uiDir} (${reason})`);
    }
  }

  throw new Error(
    `Runner-Dev docs UI assets were not found. Expected a valid docs build in one of: ${failures.join(
      ", "
    )}`
  );
}
