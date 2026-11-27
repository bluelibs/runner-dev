export interface DurableCatalogEntry {
  kind: "Workflow" | "Durable event";
  key: string;
  title: string;
  description: string;
  category: string;
  version?: number;
}
