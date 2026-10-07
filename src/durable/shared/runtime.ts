export interface DurableRuntimeCapabilities {
  pause: boolean;
  resume: boolean;
  restart: boolean;
  state: boolean;
}

export interface DurableRuntimeDescriptor {
  id: string;
  title: string;
  capabilities: DurableRuntimeCapabilities;
}
