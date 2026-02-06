import {
  startTunnelClient,
  enhancedRegisterUserTask,
  enhancedProductSyncTask,
  enhancedProcessOrderTask,
  generateBusinessReportTask,
} from "./client";
import { fraudDetectionTask, startRemoteServer } from "./server";

export {
  // Remote server exports
  validatePaymentTask,
  fetchExternalInventoryTask,
  generateReportTask,
  fraudDetectionTask,
  httpExposure,
  remoteServer,
  startRemoteServer,
} from "./server";

export {
  // Tunnel client exports
  tunnelClient,
  enhancedRegisterUserTask,
  enhancedProductSyncTask,
  enhancedProcessOrderTask,
  generateBusinessReportTask,
  tunnelClientApp,
  startTunnelClient,
} from "./client";

// ====================
// TUNNELING EXAMPLES
// ====================

export async function demonstrateTunneling() {
  console.log("🚀 Starting Tunneling Demonstration");
  console.log("=====================================");

  // Start the remote server in the background
  console.log("\n1️⃣ Starting Remote Server...");
  const serverRuntime = await startRemoteServer();

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n2️⃣ Starting Tunnel Client...");
  const clientRuntime = await startTunnelClient();

  console.log("\n3️⃣ Demonstrating Remote Task Execution...");

  try {
    // Example 1: Enhanced user registration with fraud detection
    console.log("\n📝 Example 1: Enhanced User Registration");
    const registrationResult = await clientRuntime.runTask(
      enhancedRegisterUserTask,
      {
        email: "john.doe@example.com",
        password: "SecurePassword123!",
        firstName: "John",
        lastName: "Doe",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Demo Browser)",
        billingAddress: {
          street: "123 Demo Street",
          city: "Demo City",
          country: "US",
          zipCode: "12345",
        },
      }
    );
    console.log("Registration result:", registrationResult);

    // Example 2: Product sync with external inventory
    console.log("\n📦 Example 2: Product Sync with External Inventory");
    const syncResult = await clientRuntime.runTask(enhancedProductSyncTask, {
      supplierId: "supplier_001",
      productSkus: ["DEMO_001", "DEMO_002", "DEMO_003"],
      syncType: "incremental",
      location: "warehouse_primary",
    });
    console.log("Sync result:", syncResult);

    // Example 3: Order processing with payment and fraud detection
    console.log(
      "\n💳 Example 3: Order Processing with Payment & Fraud Detection"
    );
    const orderResult = await clientRuntime.runTask(enhancedProcessOrderTask, {
      orderId: "order_demo_001",
      userId: registrationResult?.userId || "DEMO",
      items: [
        {
          productId: "prod_demo_001",
          sku: "DEMO_001",
          quantity: 2,
          price: 29.99,
        },
      ],
      paymentDetails: {
        method: "credit_card",
        amount: 59.98,
        currency: "USD",
        cardToken: "demo_card_token_12345",
        billingAddress: {
          street: "123 Demo Street",
          city: "Demo City",
          country: "US",
          zipCode: "12345",
        },
      },
      shippingAddress: {
        street: "123 Demo Street",
        city: "Demo City",
        country: "US",
        zipCode: "12345",
      },
      customerInfo: {
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Demo Browser)",
      },
    });
    console.log("Order result:", orderResult);

    // Example 4: Business report generation
    console.log("\n📊 Example 4: Business Report Generation");
    const reportResult = await clientRuntime.runTask(
      generateBusinessReportTask,
      {
        reportType: "sales",
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          endDate: new Date(),
        },
        format: "pdf",
        includeCharts: true,
        filters: {
          region: "US",
          productCategory: "electronics",
        },
      }
    );
    console.log("Report result:", reportResult);

    console.log("\n✅ Tunneling demonstration completed successfully!");
  } catch (error) {
    console.error("\n❌ Tunneling demonstration failed:", error);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");
    await clientRuntime.dispose();
    await serverRuntime.dispose();
  }
}

// ====================
// TUNNELING TESTING UTILITIES
// ====================

export async function testTunnelConnectivity() {
  console.log("🔗 Testing Tunnel Connectivity");

  const clientRuntime = await startTunnelClient();

  try {
    // Test basic connectivity with a simple task
    const result = await clientRuntime.runTask(fraudDetectionTask, {
      userId: "test_user",
      transactionId: "test_tx",
      amount: 100,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
      billingAddress: {
        country: "US",
        zipCode: "12345",
      },
    });

    console.log("✅ Tunnel connectivity test passed");
    console.log("Test result:", result);
    return true;
  } catch (error) {
    console.error("❌ Tunnel connectivity test failed:", error);
    return false;
  } finally {
    await clientRuntime.dispose();
  }
}

export async function benchmarkTunnelPerformance(iterations = 10) {
  console.log(`📈 Benchmarking Tunnel Performance (${iterations} iterations)`);

  const clientRuntime = await startTunnelClient();
  const results = [];

  try {
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();

      await clientRuntime.runTask(fraudDetectionTask, {
        userId: `bench_user_${i}`,
        transactionId: `bench_tx_${i}`,
        amount: 100 + i,
        ipAddress: "127.0.0.1",
        userAgent: "benchmark-agent",
        billingAddress: {
          country: "US",
          zipCode: "12345",
        },
      });

      const duration = Date.now() - startTime;
      results.push(duration);
      console.log(`Iteration ${i + 1}: ${duration}ms`);
    }

    const avgDuration =
      results.reduce((sum, time) => sum + time, 0) / results.length;
    const minDuration = Math.min(...results);
    const maxDuration = Math.max(...results);

    console.log("\n📊 Performance Summary:");
    console.log(`Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`Min: ${minDuration}ms`);
    console.log(`Max: ${maxDuration}ms`);

    return { avgDuration, minDuration, maxDuration, results };
  } finally {
    await clientRuntime.dispose();
  }
}
