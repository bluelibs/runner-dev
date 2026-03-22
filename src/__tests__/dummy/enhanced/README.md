# Enhanced Reference App Fixtures

This folder contains the deterministic reference app used by `npm run play`,
`npm run play:export`, and the runner-dev integration tests.

It is still fixture code, but it is intentionally shaped like a believable
production system rather than a feature showcase sampler platter.

## Purpose

- Exercise runner-dev introspection contracts against a realistic topology.
- Keep stable IDs and relationships for docs, GraphQL, and component tests.
- Provide a local reference app that looks like an actual system in the docs UI.

## Layout

- `index.ts`: builds `enhanced-superapp` from the domain roots.
- `domains/platform`: HTTP edge, request context, database, ORM, platform health.
- `domains/catalog`: public catalog boundary, repositories, sync lanes, projections.
- `domains/orders`: durable order approval workflow and order persistence nodes.
- `schemas.ts`: shared schemas used by the reference app surfaces.

## Topology Goal

The reference app should read like a small commerce platform:

- `platform`: HTTP server, async context, middleware, errors, database, ORM
- `catalog`: public search flow, repository, policies, lanes, projection updates
- `orders`: durable order review and approval flow

## Maintenance Notes

- Keep fixture IDs stable unless dependent tests change in the same pass.
- Prefer one element per file with small barrel files for assembly.
- Public-facing copy should describe a realistic reference app, not a toy showcase.
