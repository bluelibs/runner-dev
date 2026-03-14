// Standard decorators store metadata under Symbol.metadata when the runtime
// exposes it. Provide the symbol early on runtimes that do not define it yet.
Symbol.metadata ??= Symbol("Symbol.metadata");

export {};
