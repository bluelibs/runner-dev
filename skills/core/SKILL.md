---
name: Runner DevTools Usage
description: Use when working on @bluelibs/runner-dev itself, especially for docs UI behavior, introspection resources, GraphQL tooling, MCP helpers, telemetry surfaces, and agent-facing documentation. Start here when the task needs runner-dev-specific context instead of the general Runner framework skill.
---

# Runner Dev

Start with `./references/readmes/COMPACT_GUIDE.md`.
It is the canonical compact runner-dev guide and should stay aligned with the current toolkit behavior.

Use `./references/README.md` when the task needs installation, CLI, or broader user-facing usage details.
Use `./references/readmes/API_REFERENCE.md` when the task needs the current GraphQL surface used by docs or MCP flows.

Reference layout:

- `./references/README.md` mirrors the repo root `README.md`
- `./references/readmes/` mirrors the repo `readmes/` directory, including `COMPACT_GUIDE.md` and `API_REFERENCE.md`

Use this skill when the task involves:

- docs UI behavior, `/docs/data`, in-app documentation delivery, or the topology graph / blast-radius / mindmap views
- MCP helpers, GraphQL tooling, introspection resources, or chat context wiring
- live telemetry, hot-swapping, CLI surfaces, or other runner-dev tooling
- agent-facing documentation that must stay aligned with `readmes/COMPACT_GUIDE.md` and `README.md`
- GraphQL schema and MCP contract work grounded in `./references/readmes/API_REFERENCE.md`

Reach for the general Runner skill when the problem is about framework design rather than runner-dev's tooling surface.
