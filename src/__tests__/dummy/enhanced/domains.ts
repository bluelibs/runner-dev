import type { OverridableElements, RegisterableItems } from "@bluelibs/runner";
import { r } from "@bluelibs/runner";
import {
  catalogShowcaseOverrides,
  catalogShowcaseRegistrations,
  ordersShowcaseRegistrations,
  platformShowcaseRegistrations,
} from "./showcases";

export const ENHANCED_DOMAIN_IDS = {
  platform: "platform",
  catalog: "catalog",
  orders: "orders",
} as const;

export const platformDomainResource = r
  .resource(ENHANCED_DOMAIN_IDS.platform)
  .meta({
    title: "Platform",
    description:
      "Shared support primitives for the play app.\n\n- Async context\n- Middleware\n- Typed errors",
  })
  .register(platformShowcaseRegistrations)
  .build();

export const catalogDomainResource = r
  .resource(ENHANCED_DOMAIN_IDS.catalog)
  .meta({
    title: "Catalog",
    description:
      "Catalog-facing topology gathered under one subtree.\n\n- Search and tags\n- Interceptors\n- Lane examples",
  })
  .register(catalogShowcaseRegistrations)
  .build();

export const ordersDomainResource = r
  .resource(ENHANCED_DOMAIN_IDS.orders)
  .meta({
    title: "Orders",
    description:
      "Durable workflow surface for order approval.\n\n- Minimal workflow entrypoints\n- Enough structure for docs and topology",
  })
  .register(ordersShowcaseRegistrations)
  .build();

export const enhancedDomainRegistrations: RegisterableItems[] = [
  platformDomainResource,
  catalogDomainResource,
  ordersDomainResource,
];

export const enhancedDomainOverrides: OverridableElements[] = [
  ...catalogShowcaseOverrides,
];
