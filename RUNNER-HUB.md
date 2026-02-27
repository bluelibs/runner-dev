# Runner Hub

> A curated registry and marketplace for open-source Runner packages — browse, introspect, install, and support the ecosystem.

## Vision

Runner Hub is the central place where developers **discover**, **explore**, and **install** open-source Runner packages. Every listed package gets the full runner-dev documentation experience (architecture visualization, task/resource/event graphs, schema rendering) — without needing a live server. Maintainers can offer paid consulting and accept donations, creating a sustainable open-source ecosystem around `@bluelibs/runner`.

**Hosted at [`hub.runner.bluelibs.com`](https://hub.runner.bluelibs.com).**

### Phase 1 — Bootstrapping Principles

The Hub launches lean. These constraints shape every decision below:

- **Manual curation only.** There is no self-service "Runner Manager" portal yet. The Hub admin (you) reviews submissions, adds packages, triggers snapshot extraction, and approves listings.
- **Online-only Store.** The Store panel inside runner-dev always talks to the Hub API. No offline/cached mode.
- **Stripe Connect ready, solo-operated.** The payment split (80/20) is designed in, but initially you are the only operator and the only payout recipient. Multi-maintainer payouts come later.
- **Standard `npm install`.** Users install packages with npm/yarn/pnpm from the Store UI. No custom CLI install command — npm already does this perfectly.

---

## Table of Contents

- [Core Concepts](#core-concepts)
- [Store — runner-dev Integration](#store--runner-dev-integration)
- [Package Listing](#package-listing)
- [Introspection & Exploration](#introspection--exploration)
- [Installation Flow](#installation-flow)
- [Support & Sustainability Model](#support--sustainability-model)
- [Runner Manager (Publisher Portal)](#runner-manager-publisher-portal)
- [Registry Rules & Enforcement](#registry-rules--enforcement)
- [Security & Liability Framework](#security--liability-framework)
- [Architecture Overview](#architecture-overview)
- [Open Questions](#open-questions)

---

## Core Concepts

| Term               | Definition                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runner Hub**     | The central registry — web portal + API backing the Store.                                                                                                                                                                                                    |
| **Store**          | The runner-dev UI panel that surfaces Hub data inside the local DevTools.                                                                                                                                                                                     |
| **Runner Manager** | The admin-side portal for adding packages and managing versions. Initially operated solely by the Hub admin; opened to maintainers later.                                                                                                                     |
| **Listing**        | A single package entry in the Hub, scoped to one npm package and one Git repository.                                                                                                                                                                          |
| **Snapshot**       | Pre-computed **deep** introspection data (tasks, resources, events, hooks, middleware, tags, schemas, diagnostics — including all nested sub-resources) extracted at publish time for a specific semver version. Stored as a JSON column in the Hub database. |

---

## Store — runner-dev Integration

A new **"Store"** section is added to the runner-dev sidebar, giving developers direct access to the Hub without leaving DevTools.

### Store Views

#### Browse / Search

- Search by keyword, tag, or category.
- Filter by: **has consulting**, **has support**, **recently updated**, **most installed**.
- Minimal card per listing:
  - **ID** (npm package name)
  - **Title**
  - **Description**
  - **Version** (latest stable)
  - **Installed** badge (cross-checked against local `package.json`)

#### Listing Detail

When a listing is selected, the Store opens a detail view with:

| Section           | Content                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**      | Title, description, author, license, links (npm, source code, docs).                                                                                                                                                                                                                                                                         |
| **Dependencies**  | Runner-level dependencies this package declares — other Runner packages it depends on. Each dependency links to its own Hub listing (if published).                                                                                                                                                                                          |
| **Explore**       | Opens a **read-only runner-dev documentation instance** for the package. No live telemetry, no hot-swapping, no task invocation — purely static introspection. Full navigation, tree view, cards (tasks, resources, events, hooks, middleware, tags), schema rendering, and file previews. This is powered by the pre-computed **Snapshot**. |
| **Compatibility** | Semver range of `@bluelibs/runner` supported. BC guarantee status per major version.                                                                                                                                                                                                                                                         |
| **Support**       | Consulting availability (YES/NO), implementation consulting (YES/NO), donation link, direct contact with maintainer.                                                                                                                                                                                                                         |
| **Security**      | Liability disclaimer, known CVEs (if any), last audit date, license.                                                                                                                                                                                                                                                                         |

#### Dependency Exploration

Snapshots are **deep** — they capture the entire resource tree including all nested sub-resources, even those coming from other packages. This means:

- The Explore view shows the full architecture as one tree, exactly as runner-dev would show it locally.
- If a dependency is itself a Hub listing, its name appears as a clickable link that opens **that package's own listing** — so the user can jump to its dedicated page, see its support options, version history, etc.
- This keeps exploration seamless: you see everything in context, but can always drill into a dependency's Hub listing for its metadata.

### Install Action

A single **"Install"** button on any listing:

1. Reads the local project's `package.json` to determine if already installed and current version.
2. If not installed → runs `npm install <package>@<version>` (or the detected package manager: `yarn`, `pnpm`).
3. If installed but outdated → shows upgrade prompt with changelog/release notes (when available).
4. Post-install, refreshes the Store badge and optionally shows a quick-start snippet for registering the resource.

Detection logic:

```
1. Read closest package.json (dependencies + devDependencies)
2. Match against listing npm package name
3. Compare installed version against Hub latest stable
```

#### Install Execution Contract (Phase 1)

To keep trust boundaries clear, installs are executed by the local runner-dev process, **not** by Hub:

1. Store UI sends an install intent to local runner-dev (`package`, `version`, `cwd`).
2. runner-dev validates:
   - package name/version format
   - working directory is a local project root (contains `package.json`)
   - package manager is one of `npm | yarn | pnpm`
3. runner-dev shows an explicit confirmation with exact command and cwd.
4. On confirm, runner-dev executes with **arg-array spawn** (no shell interpolation):
   - npm: `npm install <pkg>@<version>`
   - yarn: `yarn add <pkg>@<version>`
   - pnpm: `pnpm add <pkg>@<version>`
5. runner-dev streams logs to the UI and returns `{ exitCode, stdout, stderr }`.
6. UI re-reads `package.json` and lockfile state, then updates the Installed badge.

This keeps Hub as metadata/snapshot provider only, while local install remains a user-approved local action.

---

## Package Standards

Every Hub package must follow these conventions to enable reliable snapshot extraction and a consistent developer experience.

### Root Export Convention

Every package must expose a **root** — a single Runner resource that serves as the entry point for the entire package. This is how runner-dev discovers and introspects the package during dry-run extraction.

#### The `runner` field in `package.json`

Packages declare their root via a `"runner"` field in `package.json`:

```json
{
  "name": "@acme/auth",
  "version": "1.0.0",
  "main": "dist/index.js",
  "runner": {
    "root": "dist/index.js",
    "export": "authResource"
  }
}
```

| Field           | Required | Description                                                                                                                                                                |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runner.root`   | Yes      | Path to the file containing the root resource export (relative to package root). Typically `dist/index.js` for published packages or `src/index.ts` for source extraction. |
| `runner.export` | No       | Named export to use. If omitted, the Hub looks for `default` export first, then an export named `app`.                                                                     |

#### Resolution Order

For **Phase 1**, root resolution is strict and deterministic:

1. Read `package.json` and require `runner.root`.
2. Load `runner.root`.
3. Resolve export in this order:
   - `runner.export` (if provided)
   - `default`
   - `app`
4. If nothing resolves to a valid Runner resource, extraction fails and listing is rejected.

> Note: fallback to `main` / `exports` is **not** part of Phase 1. It can be added later as a compatibility feature, but the registry contract starts strict.

#### Example: Typical Hub Package

```ts
// src/index.ts
import { resource } from "@bluelibs/runner";
import { authTask } from "./tasks/auth.task";
import { sessionResource } from "./resources/session.resource";
import { userRegisteredEvent } from "./events/userRegistered.event";

// The root resource — this is what the Hub introspects
export const authResource = resource({
  id: "acme.auth",
  meta: {
    title: "Acme Auth",
    description: "Authentication and session management for Runner apps",
  },
  register: [authTask, sessionResource, userRegisteredEvent],
});
```

```json
// package.json
{
  "name": "@acme/auth",
  "runner": {
    "root": "dist/index.js",
    "export": "authResource"
  }
}
```

Users install and register it:

```ts
import { authResource } from "@acme/auth";

const app = resource({
  id: "app",
  register: [
    authResource, // or authResource.with({ ... }) for configuration
    dev.with({ port: 1337 }),
  ],
});
```

#### Why This Matters

- **Snapshot extraction** needs a deterministic way to find the root without guessing file paths or export names.
- **Store "Install" flow** can generate an accurate quick-start snippet because it knows the exact export name.
- **Dependency resolution** — when package A depends on package B, the Hub can read B's `runner` field to link them automatically.
- **Tooling** — linters, IDE plugins, and CLI tools can leverage the `runner` field for auto-discovery.

---

## Package Listing

Every listing in the Hub represents exactly one npm package and one Git repository.

### Required Metadata

| Field                | Source    | Description                                                     |
| -------------------- | --------- | --------------------------------------------------------------- |
| `npmPackage`         | Publisher | npm package name (scoped or unscoped).                          |
| `sourceUrl`          | Publisher | Git repository URL. Must be public.                             |
| `title`              | Publisher | Human-friendly name.                                            |
| `description`        | Publisher | Short description (max 280 chars).                              |
| `runnerVersionRange` | Publisher | Supported `@bluelibs/runner` semver range.                      |
| `license`            | Extracted | From `package.json`.                                            |
| `version`            | Extracted | From `package.json`. Semver enforced.                           |
| `runner.root`        | Extracted | From `package.json` `runner` field. Must point to a valid file. |
| `runner.export`      | Extracted | From `package.json` `runner` field. Named export or `default`.  |

### Optional Metadata

| Field                      | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `category`                 | E.g., `auth`, `database`, `messaging`, `payments`, `monitoring`. |
| `tags`                     | Free-form searchable tags.                                       |
| `consultingAvailable`      | Maintainer is available for paid consulting.                     |
| `implementationConsulting` | Maintainer offers hands-on implementation help.                  |
| `contactEmail`             | Direct contact (shown only to authenticated users).              |
| `donationUrl`              | Stripe / GitHub Sponsors / Open Collective link.                 |
| `bcGuarantee`              | Backward-compatibility guarantee statement per major version.    |
| `securityPolicy`           | Link to `SECURITY.md` or inline policy text.                     |
| `logoUrl`                  | Package logo/icon (optional).                                    |

---

## Introspection & Exploration

This is the critical differentiator: **every Hub listing is explorable like a local runner-dev instance**.

### Snapshot Generation

When a new version needs to be snapshotted, the Hub admin triggers extraction (or it runs automatically — see [Version Sync](#version-sync)):

1. Clone the repo at the tagged version.
2. Install dependencies in a sandboxed environment.
3. Run the equivalent of `runner-dev query --entry-file <entry> --export <export>` to extract **deep** introspection data (full resource tree, including nested sub-resources from dependencies).
4. Serialize the introspection result into a **Snapshot** — a JSON blob containing the full `Introspector` output (tasks, resources, events, hooks, middleware, tags, schemas, diagnostics, file paths, code previews).
5. Store the Snapshot in the Hub database as a JSON column, keyed by `package@version`.

> **Storage rationale:** Snapshots are typically 50KB–2MB of JSON. At the expected scale (tens to low hundreds of packages), a simple database column is more than sufficient. No blob store or object storage needed.

### Version Sync

When a maintainer publishes a new version to npm, the Hub needs to know. Options (in order of preference for Phase 1):

| Strategy                   | How it works                                                                                                                                                              | Pros                                          | Cons                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| **GitHub Release Webhook** | Maintainer adds a webhook on their repo pointing to `hub.runner.bluelibs.com/webhooks/release`. On each GitHub Release, the Hub receives the tag and triggers extraction. | Real-time, reliable, standard GitHub feature. | Requires maintainer to add the webhook (or a GitHub App install). |
| **Manual trigger**         | Hub admin clicks "Sync" on a listing in the Runner Manager. Hub fetches latest npm version, compares, extracts if new.                                                    | Simplest. No infra. Full control.             | Doesn't scale; requires admin attention.                          |
| **npm registry polling**   | A cron job polls the npm registry for each listed package every N hours, compares versions, triggers extraction on new ones.                                              | Fully automatic, no maintainer setup.         | Slight delay (up to N hours). Extra infra (cron worker).          |

**Phase 1 recommendation:** Start with **manual trigger** (admin clicks Sync). Add **GitHub Release Webhook** as the first automation step — it's the most natural fit since source repos are already required to be on GitHub. Polling can be a fallback for non-GitHub repos later.

### Snapshot Version Lifecycle

Each `package@version` has an explicit lifecycle status so UI/API behavior is deterministic:

| Status       | Meaning                                                        | User-facing behavior                             |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| `queued`     | Version discovered, extraction pending.                        | Show "Snapshot pending".                         |
| `extracting` | Extractor is currently running.                                | Show in-progress state + startedAt.              |
| `ready`      | Snapshot extracted and validated.                              | Explore enabled.                                 |
| `failed`     | Extraction failed or timed out.                                | Explore disabled, show failure reason.           |
| `stale`      | Snapshot exists but is marked stale after policy/rule changes. | Explore allowed with warning; re-sync suggested. |

Required version fields in Hub API:

- `status`
- `statusUpdatedAt`
- `extractionStartedAt`
- `extractionFinishedAt`
- `failureReason` (nullable)
- `snapshotSchemaVersion`

### Read-Only Documentation Mode

The Store's "Explore" view renders the Snapshot using the same UI components as runner-dev's Documentation panel:

- `TaskCard`, `ResourceCard`, `EventCard`, `HookCard`, `MiddlewareCard`, `TagCard`
- `TreeView` for architecture navigation
- `SchemaRenderer` for zod/JSON Schema visualization
- `CodeModal` for file previews (source extracted at snapshot time)
- `NavigationView` for sidebar navigation

**Disabled features** (since there's no live server):

- Live telemetry (logs, emissions, errors, runs)
- Hot-swapping / task invocation
- Coverage visualization (no runtime)
- SSE streaming

This is essentially the runner-dev UI in **static documentation mode**, powered by the Snapshot JSON instead of a live GraphQL connection.

#### Data Access Contract (`live` vs `snapshot`)

To avoid mixed behavior, the documentation renderer runs in one explicit mode:

| Mode       | Data source                   | Allowed operations                                                            |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `live`     | GraphQL endpoint (`/graphql`) | Full docs + live panels + mutations (dev policy dependent).                   |
| `snapshot` | Hub snapshot payload only     | Read-only docs only. No GraphQL fetches for file contents/coverage/live data. |

Snapshot payload must include everything needed by read-only docs:

- Introspector-like graph data (tasks/resources/events/hooks/middleware/tags/errors/async contexts)
- Pre-resolved file preview data required by cards/modals
- Schema render inputs
- Optional coverage summary captured at extraction time (if available), clearly labeled as snapshot-time data

If a field is unavailable in snapshot mode, UI must show a deterministic "not available in snapshot mode" state instead of trying live queries.

### Cross-Package Dependencies

Dependencies are modeled as three distinct relations:

| Dependency Type            | Source                                                                             | Meaning                                                    |
| -------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packageDependencies`      | `package.json` (`dependencies`/`peerDependencies`)                                 | npm-level package relation.                                |
| `runnerDependencies`       | Hub metadata (`dependsOnPackages`)                                                 | Declared Runner package-to-package relation for discovery. |
| `architectureDependencies` | Snapshot introspection (`dependsOn`, middleware usage, emitted/listened relations) | Element-level runtime architecture relation.               |

Linking rules:

- Listing "Dependencies" section uses `runnerDependencies` (fallback to `packageDependencies` when explicitly mapped).
- Explore graph uses `architectureDependencies`.
- If a dependency package exists as a Hub listing, show a listing link alongside architectural context.
- Never infer package-level dependency solely from element-level `dependsOn`.

---

## Support & Sustainability Model

### Revenue Split

All monetary transactions (support purchases, monthly donations) follow a fixed split:

| Recipient                           | Share | Purpose                                                                      |
| ----------------------------------- | ----- | ---------------------------------------------------------------------------- |
| **Hub Operations**                  | 20%   | Hosting, CI/CD, snapshot extraction infra, moderation, platform maintenance. |
| **Package Maintainer / Contractor** | 80%   | Direct compensation to the person/org maintaining the package.               |

> **Phase 1 note:** Initially you are the sole operator and may also be the sole maintainer. The 80/20 split is designed-in for when third-party maintainers join. In the meantime, 100% goes to the Hub account. Stripe Connect is wired up from the start so adding payout recipients later is trivial.

### Support Tiers

Maintainers can define their own tiers, but the Hub provides sensible defaults:

| Tier                          | Description                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| **Community**                 | Free. GitHub issues only. No SLA.                                                               |
| **Monthly Donation**          | Recurring contribution. No guaranteed response time. Shows supporter badge.                     |
| **Priority Support**          | Paid. Guaranteed response within X business days. Private channel (email / Discord / Slack).    |
| **Implementation Consulting** | Paid. Hourly/project-based. Maintainer builds or integrates the package into your architecture. |

### Visibility in the Store

Each listing card clearly shows:

- 🟢 **Available for consulting** / 🔴 **Not available**
- 🟢 **Implementation consulting** / 🔴 **Not available**
- **"Contact Maintainer"** button (requires Hub authentication)
- **"Donate"** button → links to configured payment provider

---

## Runner Manager (Admin Portal)

> **Phase 1:** The Runner Manager is an admin-only portal. Only the Hub admin can add, edit, and approve listings. Self-service maintainer accounts come in a later phase.

### Adding a Package (Admin Workflow)

1. **Collect from the maintainer** (via email, GitHub issue, or a simple submission form):
   - **Source-code URL** (GitHub repo — must be public).
   - **npm package name** (must be public on npm).
   - Confirm `runner` field is present in `package.json` (or provide root/export info for the admin to verify).
   - Metadata: title, description, categories, support/consulting flags, contact.
2. **Admin validates**:
   - npm package exists and is public.
   - Source URL is accessible and matches the npm package.
   - Dry-run extraction succeeds.
3. **Admin approves** → listing goes live, snapshot stored in DB.

### Version Management

- Admin triggers "Sync" to fetch latest npm version and re-extract snapshot.
- Later: GitHub Release Webhook automates this (see [Version Sync](#version-sync)).
- Admin can pin supported major versions and mark older majors as deprecated.
- Each major version gets its own BC guarantee flag.
- Each synced version must expose lifecycle state (see [Snapshot Version Lifecycle](#snapshot-version-lifecycle)).

### Future: Self-Service Runner Manager

When the ecosystem grows, the portal opens to maintainers:

- OAuth login via GitHub.
- Account linked to npm username for ownership verification.
- Maintainers submit packages, admin approves.
- Dashboard: install counts, donation stats, snapshot build status, version history.

---

## Registry Rules & Enforcement

### Hard Rules

| Rule                                 | Rationale                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One repo per package**             | No monorepos publishing multiple Hub listings from the same repo. Keeps ownership, versioning, and snapshot extraction clean. If you need multiple packages, use multiple repos.                   |
| **Semver required**                  | All versions must follow [semver](https://semver.org/). Non-semver versions are rejected.                                                                                                          |
| **Public source required**           | Open-source only (initially). Source URL must be publicly accessible at all times.                                                                                                                 |
| **`runner` field in `package.json`** | Must declare `runner.root` pointing to the file that exports the package's root resource. This is how the Hub discovers what to introspect. See [Root Export Convention](#root-export-convention). |
| **Valid Runner export**              | The declared root export must resolve to a valid Runner resource. Dry-run extraction must succeed.                                                                                                 |
| **npm ownership**                    | Admin verifies the submitter owns the npm package (checked manually in Phase 1; automated via npm provenance later).                                                                               |
| **MIT / Apache-2.0 / ISC / BSD**     | Only OSI-approved permissive licenses accepted (initially). Copyleft may be supported later with clear labeling.                                                                                   |

### Soft Guidelines

- Packages should include a `README.md` with usage instructions.
- Packages should include `meta` (title, description) on their Runner elements for rich Hub display.
- The root resource's `meta.title` and `meta.description` are used as fallback for the Hub listing title/description if not overridden.
- Zod schemas on tasks/resources are strongly encouraged for schema rendering in the Store.
- Package should have tests (badge displayed if CI passes).
- `SECURITY.md` recommended.

---

## Security & Liability Framework

### Snapshot Sandbox

Dry-run extraction runs in an **isolated sandbox**:

- Ephemeral container with no network access (post dependency install).
- Resource limits (CPU, memory, time).
- No access to Hub infra or other packages.
- If extraction fails or times out, version state becomes `failed` with a stored failure reason; listing remains live.

### Liability

- The Hub is a **registry**, not a guarantor. Packages are provided "as is."
- Each listing displays its license prominently.
- Maintainers are responsible for their code's security and correctness.
- The Hub provides a **"Report"** button for security issues, which notifies the maintainer and (if unresolved after 90 days) adds a visible warning to the listing.
- The Hub may delist packages that are abandoned, malicious, or violate registry rules.

### Trust Signals

| Signal                     | Meaning                                                 |
| -------------------------- | ------------------------------------------------------- |
| ✅ **Verified Publisher**  | npm ownership confirmed.                                |
| 🛡️ **Snapshot OK**         | Dry-run extraction succeeded for latest version.        |
| 📋 **Has Security Policy** | `SECURITY.md` present in repo.                          |
| 🧪 **CI Passing**          | GitHub Actions / CI badge detected and green.           |
| 📦 **BC Guaranteed**       | Maintainer has declared BC guarantee for current major. |
| ⚠️ **Security Advisory**   | Active reported issue, unresolved.                      |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│               hub.runner.bluelibs.com                    │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Hub API     │   │  Snapshot    │   │  Admin Panel  │  │
│  │  (REST/GQL)  │◄──│  Extractor   │   │  (Runner     │  │
│  │             │   │  (on-demand) │   │   Manager)   │  │
│  └──────┬──────┘   └──────┬───────┘   └──────┬───────┘  │
│         │                 │                   │          │
│         ▼                 ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │             Hub Database                            │ │
│  │  Listings · Snapshots (JSON) · Support · Payments   │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         ▲                                      ▲
         │ (browse/install)                     │ (submit)
         │                                      │
┌────────┴─────────┐                  ┌─────────┴────────┐
│   runner-dev     │                  │   Maintainer     │
│   Store Panel    │                  │   (submits via   │
│   (Local UI)     │                  │    form/email)   │
└──────────────────┘                  └──────────────────┘
```

### Key Components

| Component                        | Responsibility                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hub API**                      | RESTful (or GraphQL) API serving listing data, snapshots, search. Hosted at `hub.runner.bluelibs.com`.                                               |
| **Snapshot Extractor**           | On-demand process (triggered by admin or webhook). Clones repo, runs dry-run extraction, stores snapshot JSON in the DB.                             |
| **Admin Panel (Runner Manager)** | Admin-only interface (Phase 1) to add/edit/approve packages, trigger syncs, view stats.                                                              |
| **Hub Database**                 | Single database storing listings metadata, snapshot JSON columns, payment records. No blob store needed.                                             |
| **Store Panel**                  | New section in the runner-dev UI — fetches from Hub API, renders snapshots using existing documentation components. Always online (no offline mode). |

### Data Flow: Publish

```
1. Maintainer publishes v2.1.0 to npm
2. Admin clicks "Sync" (or GitHub Release webhook fires)
3. Extractor clones repo@v2.1.0
4. Extractor runs: runner-dev query --entry-file <entry> --export <name> (deep introspection)
5. Serializes Introspector output → Snapshot JSON
6. Snapshot stored in Hub DB (JSON column) keyed by package@2.1.0
7. Hub API exposes updated listing with new snapshot
8. Store Panel (runner-dev UI) sees new version on next browse/refresh
```

### Data Flow: Install

```
1. Developer opens Store in runner-dev
2. Browses/searches, selects a listing
3. Explores architecture via Snapshot (read-only runner-dev docs)
4. Clicks "Install"
5. Store reads local package.json, detects package manager
6. Runs: npm install <package>@<version> (or yarn/pnpm equivalent)
7. Updates installed badge
8. Shows quick-start code snippet for registering the resource
```

---

## Decisions Log

Resolved questions and their outcomes:

| #   | Decision                | Outcome                                                                                                                                         |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hub hosting**         | `hub.runner.bluelibs.com` — managed, single instance.                                                                                           |
| 2   | **Snapshot storage**    | JSON column in the Hub database. No blob store. Snapshots are small (50KB–2MB) and volume is low (tens to hundreds of packages).                |
| 3   | **Version sync**        | Manual "Sync" button in Phase 1. GitHub Release Webhook as first automation. npm polling as future fallback. See [Version Sync](#version-sync). |
| 4   | **Package scoping**     | Both scoped (`@scope/pkg`) and unscoped packages are accepted. No restriction.                                                                  |
| 5   | **Private packages**    | Not in Phase 1. Future enterprise feature.                                                                                                      |
| 6   | **Snapshot depth**      | **Deep.** Snapshots capture the full resource tree including all nested sub-resources from dependencies.                                        |
| 7   | **Payment provider**    | Stripe Connect. Designed for 80/20 split but initially solo-operated (100% to Hub account).                                                     |
| 8   | **Moderation**          | Admin-only manual review in Phase 1.                                                                                                            |
| 9   | **Offline Store**       | No. Store always requires network access to `hub.runner.bluelibs.com`.                                                                          |
| 10  | **CLI install command** | No. Standard `npm install` / `yarn add` / `pnpm add` is sufficient. The Store UI triggers npm directly.                                         |

---

## Open Questions

Remaining items to figure out:

| #   | Question                            | Considerations                                                                                                                                       |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Hub tech stack**                  | Runner-based backend (eat your own dogfood)? Or a lightweight Node/Express API? Database: PostgreSQL (JSONB for snapshots) vs SQLite for simplicity? |
| 2   | **Store UI design**                 | How tightly integrated with the existing runner-dev sidebar? New top-level tab? Or a dedicated section within the Documentation panel?               |
| 3   | **Snapshot extraction environment** | Docker container? GitHub Actions workflow? Local script on the Hub server? Needs sandboxing for untrusted code.                                      |
| 4   | **Authentication for Store**        | Is Hub auth required to browse? Or only for contact/support actions? Recommendation: browse is public, auth for contact + install tracking.          |
| 5   | **Submission flow**                 | Simple Google Form? GitHub issue template? Dedicated submission page on `hub.runner.bluelibs.com`?                                                   |
