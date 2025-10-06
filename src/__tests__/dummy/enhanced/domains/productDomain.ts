import { r, task, resource, event, hook, globals } from "@bluelibs/runner";
import {
  ProductDomainErrors,
  ProductNotFoundError,
  InvalidPriceError,
} from "../errors";
import {
  RequestContext,
  AuditContext,
  TenantContext,
  BusinessContext,
} from "../contexts";
import { enhancedProductSyncTask } from "../tunneling";
import z from "zod";

// Simple product events
export const productEnhancedCreatedEvent = r
  .event("app.products.events.enhancedCreated")
  .build();

export const productInventoryCriticalEvent = r
  .event("app.products.events.inventoryCritical")
  .build();

export const productPriceChangeRequestedEvent = r
  .event("app.products.events.priceChangeRequested")
  .build();

// Simple product resources
export const enhancedProductDatabaseResource = r
  .resource("app.products.resources.enhancedDatabase")
  .dependencies({})
  .init(async (_config, deps) => {})
  .build();

export const productPricingEngineResource = r
  .resource("app.products.resources.pricingEngine")
  .dependencies({
    tenantContext: TenantContext,
    businessContext: BusinessContext,
  })
  .init(async (_config, deps) => {
    return {};
  })
  .build();

// Simple product tasks
export const enhancedCreateProductTask = r
  .task("app.products.tasks.enhancedCreate")
  .dependencies({
    db: enhancedProductDatabaseResource,
    pricingEngine: productPricingEngineResource,
    requestContext: RequestContext,
    auditContext: AuditContext,
    tenantContext: TenantContext,
    businessContext: BusinessContext,
    emitProductCreated: productEnhancedCreatedEvent,
  })
  .inputSchema(z.object({ name: z.string() }))
  .run(async (input, deps) => {
    const productId = `product_${Date.now()}`;
    await deps.emitProductCreated({});
    return { productId, name: input.name };
  })
  .build();

export const enhancedUpdateInventoryTask = r
  .task("app.products.tasks.enhancedUpdateInventory")
  .dependencies({
    db: enhancedProductDatabaseResource,
    requestContext: RequestContext,
    auditContext: AuditContext,
    tenantContext: TenantContext,
    emitInventoryCritical: productInventoryCriticalEvent,
  })
  .run(async (input: { productId: string }, deps) => {
    await deps.emitInventoryCritical({});
    return { productId: input.productId, totalStock: 100 };
  })
  .build();

// Simple hooks
export const productPriceOptimizationHook = r
  .hook("app.products.hooks.priceOptimization")
  .on(productPriceChangeRequestedEvent)
  .dependencies({
    pricingEngine: productPricingEngineResource,
    auditContext: AuditContext,
  })
  .run(async (event, { pricingEngine, auditContext }) => {
    // Hook logic for price optimization
  })
  .build();

export const productInventoryRestockHook = r
  .hook("app.products.hooks.inventoryRestock")
  .on(productInventoryCriticalEvent)
  .dependencies({
    auditContext: AuditContext,
  })
  .run(async (event, { auditContext }) => {
    // Hook logic for inventory restock
  })
  .build();
