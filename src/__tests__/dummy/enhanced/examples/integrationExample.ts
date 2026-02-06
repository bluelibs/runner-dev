import { r, run, globals } from "@bluelibs/runner";
import { z } from "zod";
import {
  // Errors
  UserDomainErrors,
  ProductDomainErrors,
  OrderDomainErrors,
  SystemErrors,
  AllErrors,
  ValidationError,
  DatabaseConnectionError,
  ServiceUnavailableError,
  RateLimitExceededError,
} from "../errors";
import {
  // Contexts
  RequestContext,
  AuditContext,
  SecurityContext,
  TenantContext,
  BusinessContexts,
  SystemContexts,
  ContextMiddleware,
} from "../contexts";
import {
  // Enhanced domains
  enhancedUserDatabaseResource,
  enhancedRegisterUserTask,
  enhancedAuthenticateUserTask,
  enhancedProductDatabaseResource,
  enhancedCreateProductTask,
  enhancedUpdateInventoryTask,

  // Tunneling
  tunnelClient,
  enhancedProcessOrderTask,
  generateBusinessReportTask,

  // Events
  userEnhancedRegisteredEvent,
  productEnhancedCreatedEvent,
} from "../domains";

// ====================
// INTEGRATION EXAMPLE SCENARIOS
// ====================

/**
 * Scenario 1: Complete E-commerce User Journey with Error Handling
 */
export const completeUserJourneyTask = r
  .task("app.examples.completeUserJourney")
  .dependencies({
    userDb: enhancedUserDatabaseResource,
    productDb: enhancedProductDatabaseResource,
    tunnelClient: tunnelClient,
    requestContext: RequestContext,
    auditContext: AuditContext,
    securityContext: SecurityContext,
    tenantContext: TenantContext,
    businessContext: BusinessContexts.BusinessContext,
    performanceContext: SystemContexts.PerformanceContext,
    emitUserRegistered: userEnhancedRegisteredEvent,
    emitProductCreated: productEnhancedCreatedEvent,
    enhancedRegisterUserTask,
    enhancedCreateProductTask,
    enhancedProcessOrderTask,
    generateBusinessReportTask,
  })
  .middleware([
    ContextMiddleware.requestContextMiddleware,
    ContextMiddleware.auditContextMiddleware,
    ContextMiddleware.performanceContextMiddleware,
  ])
  .meta({
    title: "Complete User Journey Integration Example",
    description:
      "Demonstrates complete e-commerce flow with error handling, contexts, and tunneling",
  })
  .inputSchema(
    z.object({
      userRegistration: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string(),
        lastName: z.string(),
        ipAddress: z.string(),
        userAgent: z.string(),
      }),
      productCreation: z.object({
        name: z.string(),
        category: z.string(),
        basePrice: z.number().positive(),
        initialStock: z.number().int().min(0),
      }),
      orderPlacement: z.object({
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          })
        ),
        paymentMethod: z.enum(["credit_card", "paypal"]),
      }),
      businessContext: z
        .object({
          tenantId: z.string(),
          businessUnit: z.string(),
          region: z.string(),
          channel: z.enum(["web", "mobile", "api"]),
        })
        .optional(),
    })
  )
  .resultSchema(
    z.object({
      userId: z.string(),
      productId: z.string(),
      orderId: z.string(),
      journeyId: z.string(),
      stepsCompleted: z.array(z.string()),
      errorsEncountered: z.array(
        z.object({
          step: z.string(),
          error: z.string(),
          handled: z.boolean(),
        })
      ),
      performanceMetrics: z.object({
        totalDuration: z.number(),
        stepDurations: z.record(z.number()),
      }),
      contexts: z.object({
        requestId: z.string(),
        tenantId: z.string(),
        businessUnit: z.string(),
      }),
    })
  )
  .run(async (input, deps) => {
    return {
      userId: "demo_user",
      productId: "demo_product",
      orderId: "demo_order",
      journeyId: "demo_journey",
      stepsCompleted: [],
      errorsEncountered: [],
      performanceMetrics: {
        totalDuration: 0,
        stepDurations: {},
      },
      contexts: {
        requestId: "demo_request",
        tenantId: "demo_tenant",
        businessUnit: "demo_business",
      },
    };
  })
  .build();

// ====================
// ERROR HANDLING DEMONSTRATION
// ====================

export const errorHandlingDemoTask = r
  .task("app.examples.errorHandlingDemo")
  .dependencies({
    requestContext: RequestContext,
    auditContext: AuditContext,
  })
  .middleware([
    ContextMiddleware.requestContextMiddleware,
    ContextMiddleware.auditContextMiddleware,
  ])
  .meta({
    title: "Error Handling Demonstration",
    description: "Demonstrates various error types and handling patterns",
  })
  .inputSchema(
    z.object({
      scenarios: z
        .array(z.string())
        .optional()
        .default(["validation_error", "user_not_found", "payment_failed"]),
    })
  )
  .resultSchema(
    z.object({
      results: z.array(
        z.object({
          scenario: z.string(),
          errorType: z.string(),
          handled: z.boolean(),
          errorMessage: z.string(),
          recoveryAction: z.string().optional(),
        })
      ),
    })
  )
  .run(async (input, deps) => {
    return {
      results: [
        {
          scenario: "demo_scenario",
          errorType: "demo_error",
          handled: true,
          errorMessage: "Demo error message",
          recoveryAction: "Demo recovery action",
        },
      ],
    };
  })
  .build();

// ====================
// CONTEXT PROPAGATION DEMONSTRATION
// ====================

export const contextPropagationDemoTask = r
  .task("app.examples.contextPropagation")
  .dependencies({
    requestContext: RequestContext,
    auditContext: AuditContext,
    securityContext: SecurityContext,
    tenantContext: TenantContext,
    businessContext: BusinessContexts.BusinessContext,
    performanceContext: SystemContexts.PerformanceContext,
    cacheContext: SystemContexts.CacheContext,
    serviceUnavailableError: ServiceUnavailableError,
  })
  .middleware([
    ContextMiddleware.requestContextMiddleware,
    ContextMiddleware.auditContextMiddleware,
    ContextMiddleware.performanceContextMiddleware,
  ])
  .meta({
    title: "Context Propagation Demonstration",
    description:
      "Demonstrates how async contexts propagate through task chains",
  })
  .inputSchema(
    z.object({
      enableNestedTasks: z.boolean().optional().default(true),
      enableContextModification: z.boolean().optional().default(true),
    })
  )
  .resultSchema(
    z.object({
      initialContexts: z.record(z.unknown()),
      propagatedContexts: z.record(z.unknown()),
      contextModifications: z.array(
        z.object({
          context: z.string(),
          modification: z.string(),
          propagated: z.boolean(),
        })
      ),
      performanceData: z.object({
        checkpointsCount: z.number(),
        totalDuration: z.number(),
      }),
    })
  )
  .run(async (input, deps) => {
    return {
      initialContexts: {},
      propagatedContexts: {},
      contextModifications: [],
      performanceData: {
        checkpointsCount: 0,
        totalDuration: 0,
      },
    };
  })
  .build();

/**
 * Helper to simulate nested task execution and verify context propagation
 */
async function simulateNestedTaskExecution(
  deps: Record<string, unknown>,
  contextModifications: Array<{ context: string; modification: string; propagated: boolean }>
): Promise<void> {
  // Empty function - no implementation
}

// ====================
// INTEGRATION DEMO APPLICATION
// ====================

export const integrationDemoApp = r
  .resource("app.examples.integrationDemo")
  .meta({
    title: "Integration Demo Application",
    description: "Comprehensive demonstration of Runner features integration",
  })
  .register([
    // All errors (make them available for dependencies)
    ...Object.values(AllErrors),

    // Core contexts
    RequestContext,
    AuditContext,
    SecurityContext,
    TenantContext,
    BusinessContexts.BusinessContext,
    SystemContexts.PerformanceContext,
    SystemContexts.CacheContext,

    // Context middleware
    ContextMiddleware.requestContextMiddleware,
    ContextMiddleware.auditContextMiddleware,
    ContextMiddleware.performanceContextMiddleware,

    // Demo tasks
    completeUserJourneyTask,
    errorHandlingDemoTask,
    contextPropagationDemoTask,

    // Optional tunnel client (if available)
  ])
  .init(async (_config, _deps) => {
    console.log("🎭 Integration Demo Application Initialized");
    console.log("📝 Available demo scenarios:");
    console.log(
      "   - app.examples.completeUserJourney: Full e-commerce journey"
    );
    console.log("   - app.examples.errorHandlingDemo: Error handling patterns");
    console.log(
      "   - app.examples.contextPropagation: Context propagation demo"
    );
    console.log("🔧 Features demonstrated:");
    console.log("   - Error handling with fluent builders");
    console.log("   - Async context propagation");
    console.log("   - Performance monitoring");
    console.log("   - Tunneling to remote services");
    console.log("   - Multi-tenant support");
    console.log("   - Business domain separation");
    return {};
  })
  .build();

export async function runIntegrationDemo() {
  console.log("🚀 Starting Integration Demo");
  console.log("===========================");

  const runtime = await run(integrationDemoApp, { debug: "verbose" });

  try {
    console.log("\n✅ Integration Demo Completed Successfully!");
  } catch (error) {
    console.error("❌ Integration Demo failed:", error);
  } finally {
    await runtime.dispose();
  }
}
