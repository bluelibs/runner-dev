# Enhanced Dummy Fixtures

This folder contains internal fixtures used by `runner-dev` tests and local exploration.
It is intentionally test-oriented and not a copy/paste template for production apps.

## Purpose

- Exercise introspection contracts across multiple capabilities in one compact app.
- Keep deterministic IDs and relationships for component and GraphQL assertions.
- Provide a quick local playground for validating structural changes.

## Current Layout

- `index.ts`: builds `enhanced.superapp` from showcase registrations.
- `showcases/`: focused modules for each capability surface.

## Showcase Coverage

- `tagsIsolation.showcase.ts`: tag handlers and isolation rules.
- `interceptors.showcase.ts`: interceptor ownership and middleware wiring.
- `lanes.showcase.ts`: RPC lane + Event lane entities and lane resources.
- `durable.showcase.ts`: durable workflow resource/task relationships.
- `support.showcase.ts`: support context and error usage paths.

## Maintenance Notes

- Keep fixture IDs stable unless tests are updated in the same change.
- Favor small, composable showcase modules over monolithic examples.
- Treat this folder as a test contract, not end-user documentation.
