// ====================
// ENHANCED DUMMY SUPER APP
// ====================

// Core exports
export {
  // Error definitions
  UserDomainErrors,
  ProductDomainErrors,
  OrderDomainErrors,
  SystemErrors,
  AllErrors,
} from "./errors";

export {
  // Async context definitions
  CoreContexts,
  BusinessContexts,
  SystemContexts,
  AllContexts,
  ContextMiddleware,
} from "./contexts";

export {
  // Tunneling components
  tunnelClient,
  enhancedRegisterUserTask,
  enhancedProductSyncTask,
  enhancedProcessOrderTask,
  generateBusinessReportTask,
  tunnelClientApp,
  startTunnelClient,
  demonstrateTunneling,
  testTunnelConnectivity,
  benchmarkTunnelPerformance,
} from "./tunneling";
export {
  validatePaymentTask,
  fetchExternalInventoryTask,
  generateReportTask,
  fraudDetectionTask,
  httpExposure,
  remoteServer,
  startRemoteServer,
} from "./tunneling/server";

export {
  // Enhanced domain components
  userEnhancedRegisteredEvent,
  userAuthenticationFailedEvent,
  userSuspiciousActivityEvent,
  enhancedUserDatabaseResource,
  userSecurityServiceResource,
  enhancedRegisterUserTask as userEnhancedRegisterUserTask,
  enhancedAuthenticateUserTask,
  userRegistrationSecurityHook,
  userSuspiciousActivityHook,
  productEnhancedCreatedEvent,
  productInventoryCriticalEvent,
  productPriceChangeRequestedEvent,
  enhancedProductDatabaseResource,
  productPricingEngineResource,
  enhancedCreateProductTask,
  enhancedUpdateInventoryTask,
  productPriceOptimizationHook,
  productInventoryRestockHook,
} from "./domains";

export {
  // Integration examples
  completeUserJourneyTask,
  errorHandlingDemoTask,
  contextPropagationDemoTask,
  integrationDemoApp,
  runIntegrationDemo,
} from "./examples/integrationExample";

import { r, run, globals, RegisterableItems } from "@bluelibs/runner";
import { z } from "zod";
import {
  CoreContexts,
  BusinessContexts,
  SystemContexts,
  AllContexts,
  ContextMiddleware,
} from "./contexts";
import {
  AllErrors,
} from "./errors";
import {
  enhancedUserDatabaseResource,
  userSecurityServiceResource,
  enhancedRegisterUserTask,
  enhancedAuthenticateUserTask,
  userRegistrationSecurityHook,
  userSuspiciousActivityHook,
  enhancedProductDatabaseResource,
  productPricingEngineResource,
  enhancedCreateProductTask,
  enhancedUpdateInventoryTask,
  productPriceOptimizationHook,
  productInventoryRestockHook,
  tunnelClient,
  userEnhancedRegisteredEvent,
  userSuspiciousActivityEvent,
  productPriceChangeRequestedEvent,
  productInventoryCriticalEvent,
} from "./domains";
import { startRemoteServer } from "./tunneling/server";
import {
  demonstrateTunneling,
  enhancedProcessOrderTask,
  generateBusinessReportTask,
} from "./tunneling";
import {
  completeUserJourneyTask,
  errorHandlingDemoTask,
  contextPropagationDemoTask,
  runIntegrationDemo,
} from "./examples/integrationExample";

// ====================
// MAIN ENHANCED APPLICATION
// ====================

export const createEnhancedSuperApp = (extra: RegisterableItems[] = []) => {
  return r
    .resource("enhanced.superapp")
    .meta({
      title: "Enhanced E-Commerce Super App",
      description:
        "Comprehensive e-commerce application with advanced Runner features",
    })
    .register([
      // Core contexts
      ...Object.values(AllContexts),

      // Error definitions
      ...Object.values(AllErrors),

      // Context middleware
      ...Object.values(ContextMiddleware),

      userEnhancedRegisteredEvent,
      userSuspiciousActivityEvent,
      productPriceChangeRequestedEvent,
      productInventoryCriticalEvent,
      enhancedProcessOrderTask,
      generateBusinessReportTask,

      // Enhanced domains
      enhancedUserDatabaseResource,
      userSecurityServiceResource,
      enhancedProductDatabaseResource,
      productPricingEngineResource,

      // Domain tasks and hooks
      enhancedRegisterUserTask,
      enhancedAuthenticateUserTask,
      userRegistrationSecurityHook,
      userSuspiciousActivityHook,
      enhancedCreateProductTask,
      enhancedUpdateInventoryTask,
      productPriceOptimizationHook,
      productInventoryRestockHook,

      // Demo tasks
      completeUserJourneyTask,
      errorHandlingDemoTask,
      contextPropagationDemoTask,

      // Tunneling (optional - requires remote server)
      tunnelClient,

      // Extra registrations
      ...extra,
    ])
    .init(async (_config, _deps) => {
      console.log("🚀 Enhanced Super App Initialized with Errors and Contexts");
      console.log("================================");
      console.log("🔧 Advanced Features:");
      console.log("   ✅ Fluent error builders with domain-specific errors");
      console.log("   ✅ Async context propagation with middleware");
      console.log("   ✅ Performance monitoring and tracking");
      console.log("   ✅ Multi-tenant and business context support");
      console.log("   ✅ Enhanced user management with security");
      console.log("   ✅ Dynamic product pricing and inventory");
      console.log("   ✅ Comprehensive error handling");
      console.log("   ✅ Integration examples and demos");
      console.log("   🔗 Tunneling support (when remote server available)");
      console.log("");
      console.log("📊 Available Demo Tasks:");
      console.log(
        "   🎭 app.examples.completeUserJourney - Full e-commerce journey"
      );
      console.log(
        "   ⚠️  app.examples.errorHandlingDemo - Error handling patterns"
      );
      console.log(
        "   🔄 app.examples.contextPropagation - Context propagation demo"
      );
      console.log("");
      console.log("🛍️  Available Business Tasks:");
      console.log(
        "   👤 app.users.tasks.enhancedRegister - Enhanced user registration"
      );
      console.log(
        "   🔐 app.users.tasks.enhancedAuthenticate - Enhanced authentication"
      );
      console.log(
        "   📦 app.products.tasks.enhancedCreate - Enhanced product creation"
      );
      console.log(
        "   📊 app.products.tasks.enhancedUpdateInventory - Enhanced inventory management"
      );
      console.log("");
      console.log("🎯 Ready for advanced Runner demonstrations!");
      return {};
    })
    .build();
};

// ====================
// QUICK START FUNCTIONS
// ====================

/**
 * Quick start the enhanced demo application
 */
export async function startEnhancedDemo() {
  console.log("🎬 Starting Enhanced Demo Application");
  console.log("=====================================");

  const app = createEnhancedSuperApp();
  const runtime = await run(app, { debug: "verbose" });

  // Auto-start integration demo if this file is run directly
  if (require.main === module) {
    await runIntegrationDemo();
  }

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down Enhanced Demo Application...");
    await runtime.dispose();
    process.exit(0);
  });

  return runtime;
}

/**
 * Quick tunneling demo with both server and client
 */
export async function quickTunnelingDemo() {
  console.log("🌐 Quick Tunneling Demo");
  console.log("=======================");

  // Start remote server
  console.log("\n🚀 Starting Remote Server...");
  const serverRuntime = await startRemoteServer();

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // Run tunneling demonstration
    await demonstrateTunneling();
  } catch (error) {
    console.error("❌ Tunneling demo failed:", error);
  } finally {
    await serverRuntime.dispose();
  }
}

/**
 * Quick error handling demonstration
 */
export async function quickErrorDemo() {
  console.log("⚠️  Quick Error Handling Demo");
  console.log("=============================");

  const app = createEnhancedSuperApp();
  const runtime = await run(app, { debug: "verbose" });

  try {
    const results = await runtime.runTask(errorHandlingDemoTask, {
      scenarios: [
        "validation_error",
        "user_not_found",
        "insufficient_stock",
        "payment_failed",
        "rate_limit",
      ],
    });

    console.log("\n📊 Error Handling Results:");
    results?.results?.forEach((result: unknown) => {
      const res = result as { scenario: string; handled: boolean; errorType: string };
      console.log(
        `  ${res.scenario}: ${
          res.handled ? "✅ Handled" : "❌ Failed"
        } - ${res.errorType}`
      );
    });
  } finally {
    await runtime.dispose();
  }
}

/**
 * Quick context propagation demonstration
 */
export async function quickContextDemo() {
  console.log("🔄 Quick Context Propagation Demo");
  console.log("=================================");

  const app = createEnhancedSuperApp();
  const runtime = await run(app, { debug: "verbose" });

  try {
    const results = await runtime.runTask(contextPropagationDemoTask, {
      enableNestedTasks: true,
      enableContextModification: true,
    });

    console.log("\n📊 Context Propagation Results:");
    console.log(
      `  Contexts modified: ${results?.contextModifications?.length || 0}`
    );
    console.log(
      `  Performance checkpoints: ${
        results?.performanceData?.checkpointsCount || 0
      }`
    );
    console.log(
      `  Total duration: ${results?.performanceData?.totalDuration || 0}ms`
    );
  } finally {
    await runtime.dispose();
  }
}

// ====================
// COMPREHENSIVE DEMO FUNCTION
// ====================

/**
 * Run all demonstrations in sequence
 */
export async function runAllDemos() {
  console.log("🎭 Running All Enhanced Demos");
  console.log("=============================");

  try {
    // Demo 1: Error Handling
    console.log("\n1️⃣ Error Handling Demo");
    await quickErrorDemo();

    // Demo 2: Context Propagation
    console.log("\n2️⃣ Context Propagation Demo");
    await quickContextDemo();

    // Demo 3: Tunneling (if environment supports it)
    console.log("\n3️⃣ Tunneling Demo");
    try {
      await quickTunnelingDemo();
    } catch (error) {
      console.log("⚠️  Tunneling demo skipped (requires environment setup)");
    }

    // Demo 4: Complete Integration
    console.log("\n4️⃣ Complete Integration Demo");
    await startEnhancedDemo();

    console.log("\n🎉 All demos completed successfully!");
  } catch (error) {
    console.error("\n❌ Demo execution failed:", error);
  }
}

// Auto-start if this file is run directly
if (require.main === module) {
  runAllDemos().catch(console.error);
}
