import { resource } from "@bluelibs/runner";
import type { Introspector } from "./models/Introspector";
import { introspector } from "./introspector.resource";
import type {
  Resource,
  Task,
  Event,
  Hook,
  Middleware,
  BaseElement,
} from "../schema/model";
import * as fs from "fs";
import * as path from "path";

const TOC = `
## Table of Contents
- [Resources](#resources)
- [Tasks](#tasks)
- [Events](#events)
- [Hooks](#hooks)
- [Middlewares](#middlewares)
`;

function mdAnchor(text: string, type: string): string {
  const anchor = `${type.toLowerCase()}-${text.replace(/[.]/g, "")}`;
  return `[${text}](#${anchor})`;
}

function mdSection(text: string, type: string): string {
  const anchor = `${type.toLowerCase()}-${text.replace(/[.]/g, "")}`;
  return `<a name="${anchor}"></a>\n### 
${text}

`;
}

function mdFile(filePath?: string | null): string {
  return filePath
    ? `*Source: 
${filePath}
*`
    : "";
}

function mdMeta(meta?: { description?: string | null } | null): string {
  return meta?.description ? `\n\n> ${meta.description}` : "";
}

function mdList(items: string[], type: string): string {
  if (!items.length) return "";
  return items.map((item) => `- ${mdAnchor(item, type)}`).join("\n");
}

function mdSchema(schemaName: string, schema?: string | null): string {
  if (!schema) return "";
  return `
**${schemaName}:**
\`\`\`typescript
${schema}
\`\`\`
`;
}

export class DocsGenerator {
  constructor(
    private readonly introspector: Introspector,
    private readonly frameworkDocs: string
  ) {}

  public generateMarkdown(): string {
    const parts: string[] = [
      this.frameworkDocs,
      "# On-the-Fly Application Documentation",
      "This document is generated live from the running application's introspection data. All IDs are linked for easy navigation.",
      TOC,
      this.generateResourcesSection(),
      this.generateTasksSection(),
      this.generateEventsSection(),
      this.generateHooksSection(),
      this.generateMiddlewaresSection(),
    ];

    return parts.join("\n\n---\n\n");
  }

  private generateResourcesSection(): string {
    const resources = this.introspector.getResources();
    const parts = ["## Resources"];
    for (const r of resources) {
      parts.push(`

${mdSection(r.id, "resource")}
${mdFile(r.filePath)}
${mdMeta(r.meta)}

**Depends On:**
${mdList(r.dependsOn, "resource")}

**Registers:**
${mdList(r.registers, "any")}

**Overrides:**
${mdList(r.overrides, "any")}

**Middleware:**
${mdList(r.middleware, "middleware")}

${mdSchema("Config Schema", r.configSchema)}
`);
    }
    return parts.join("\n\n");
  }

  private generateTasksSection(): string {
    const tasks = this.introspector.getTasks();
    const parts = ["## Tasks"];
    for (const t of tasks) {
      parts.push(`

${mdSection(t.id, "task")}
${mdFile(t.filePath)}
${mdMeta(t.meta)}

**Depends On:**
${mdList(t.dependsOn, "resource")}

**Emits:**
${mdList(t.emits, "event")}

**Middleware:**
${mdList(t.middleware, "middleware")}

${mdSchema("Input Schema", t.inputSchema)}
`);
    }
    return parts.join("\n\n");
  }

  private generateEventsSection(): string {
    const events = this.introspector.getEvents();
    const parts = ["## Events"];
    for (const e of events) {
      const emitters = this.introspector
        .getEmittersOfEvent(e.id)
        .map((em) => em.id);
      parts.push(`

${mdSection(e.id, "event")}
${mdFile(e.filePath)}
${mdMeta(e.meta)}

**Emitted By:**
${mdList(emitters, "any")}

**Listened To By:**
${mdList(e.listenedToBy, "hook")}

${mdSchema("Payload Schema", e.payloadSchema)}
`);
    }
    return parts.join("\n\n");
  }

  private generateHooksSection(): string {
    const hooks = this.introspector.getHooks();
    const parts = ["## Hooks"];
    for (const h of hooks) {
      parts.push(`

${mdSection(h.id, "hook")}
${mdFile(h.filePath)}
${mdMeta(h.meta)}

**Listens to Event:**
${mdAnchor(h.event, "event")}

**Hook Order:** ${h.hookOrder ?? "default"}

**Depends On:**
${mdList(h.dependsOn, "resource")}

**Emits:**
${mdList(h.emits, "event")}
`);
    }
    return parts.join("\n\n");
  }

  private generateMiddlewaresSection(): string {
    const middlewares = this.introspector.getMiddlewares();
    const parts = ["## Middlewares"];
    for (const m of middlewares) {
      const usedBy = this.introspector.getTasksUsingMiddlewareDetailed(m.id);
      parts.push(`

${mdSection(m.id, "middleware")}
${mdFile(m.filePath)}
${mdMeta(m.meta)}

**Used By Tasks:**
${mdList(
  usedBy.map((u) => u.id),
  "task"
)}

${mdSchema("Config Schema", m.configSchema)}
`);
    }
    return parts.join("\n\n");
  }
}

export const docsGenerator = resource({
  id: "runner-dev.resources.docs-generator",
  dependencies: {
    introspector,
  },
  async init(_, { introspector }): Promise<DocsGenerator> {
    const mdcPath = path.join(process.cwd(), ".cursor", "rules", "runner.mdc");
    const frameworkDocsWithFrontmatter = fs.readFileSync(mdcPath, "utf-8");
    const frameworkDocs = frameworkDocsWithFrontmatter
      .replace(/---[\s\S]*?---/, "")
      .trim();
    return new DocsGenerator(introspector, frameworkDocs);
  },
});
