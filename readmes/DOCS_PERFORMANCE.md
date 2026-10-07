# Large docs graph simulation

Measured locally on 2026-10-07 with Runner Dev 6.9.0. These are synthetic local measurements, not hosted CrystalSpec latency measurements.

The fixture has 1,000 task definitions referencing a shared dependency DAG and an operator resource embedded in root configuration. Only seven shared resource definitions exist; JSON repeats them through registration and dependency edges. The baseline restores the previous expanded root config and full tag relations. The optimized path uses the real docs payload builder, HTTP handler, compression and client introspector hydration.

| Measurement | Previous representation | Optimized |
| --- | ---: | ---: |
| Root config | 98,992,635 bytes | 62 bytes |
| Complete docs JSON | 118,679,620 bytes | 1,315,951 bytes |
| Gzip HTTP response | Uncompressed previously | 160,432 bytes |
| Serialization / build | 1,531 ms (serialization only) | 310 ms (includes docs loading and graph mapping) |
| Hydration | Not measured | 31 ms |
| Task definitions after hydration | 1,000 | 1,000 |

The JSON reduction is **98.9%**; transfer reduction from the previous uncompressed payload is **99.86%**. The cold HTTP request took 136 ms in this run; eight simultaneous cached requests had a median of 6 ms. Ten requests triggered one payload build, and conditional revalidation returned `304` with no body. Timings vary with JIT, filesystem caches and machine load; the byte counts and complete task/tag preservation are the main release criteria.

Reproduce from the repository:

```sh
node node_modules/tsx/dist/cli.mjs --tsconfig config/ts/tsconfig.json scripts/benchmark-docs.ts
```

Config previews are bounded before serialization, and embedded Runner definitions become references with configured settings. Every registered element remains in the graph. Tag relation bodies are reconstructed by the bundled UI from those complete lists; legacy snapshots remain supported. Gzip is prepared lazily and shared. The single response cache expires after five seconds and does not retain an unbounded set of namespaces.

For hosted applications, forward `Accept-Encoding` and `If-None-Match` through the proxy and preserve `Content-Encoding`, `Vary`, `ETag` and `Cache-Control`. Payload compaction works even when these headers are stripped, but compression and revalidation benefits depend on the proxy.
