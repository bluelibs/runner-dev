export type DurableRuntimeBackend =
  | "memory"
  | "persistent-memory"
  | "sqlite"
  | "postgres"
  | "redis"
  | "custom";

export interface DurableRuntimeCapabilities {
  pause: boolean;
  resume: boolean;
  restart: boolean;
  state: boolean;
  command?: boolean;
  reset?: boolean;
  replay?: boolean;
}

export interface DurableRuntimeDescriptor {
  id: string;
  title: string;
  backend?: DurableRuntimeBackend;
  capabilities: DurableRuntimeCapabilities;
}
