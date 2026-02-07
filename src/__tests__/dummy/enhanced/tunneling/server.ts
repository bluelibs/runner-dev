import { r, run } from "@bluelibs/runner";
import { nodeExposure } from "@bluelibs/runner/node";
import { z } from "zod";

// ====================
// REMOTE TASK DEFINITIONS
// ====================

// Payment Gateway Validation Task
export const validatePaymentTask = r
  .task("remote.tasks.validatePayment")
  .inputSchema(
    z.object({
      paymentMethod: z.enum(["credit_card", "debit_card", "paypal", "stripe"]),
      amount: z.number().positive(),
      currency: z.string(),
      cardToken: z.string().optional(),
      paypalToken: z.string().optional(),
      billingAddress: z.object({
        street: z.string(),
        city: z.string(),
        country: z.string(),
        zipCode: z.string(),
      }),
    })
  )
  .resultSchema(
    z.object({
      valid: z.boolean(),
      transactionId: z.string(),
      authCode: z.string().optional(),
      riskScore: z.number().min(0).max(100),
      requires3DS: z.boolean(),
      message: z.string(),
    })
  )
  .run(async (input) => {
    console.log(
      `Validating ${input.paymentMethod} payment for ${input.amount} ${input.currency}`
    );

    // Simulate payment gateway validation
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay

    // Simulate different validation scenarios
    const isValid = Math.random() > 0.1; // 90% success rate
    const requires3DS = input.amount > 1000 && Math.random() > 0.5;
    const riskScore = Math.floor(Math.random() * 100);

    if (!isValid) {
      return {
        valid: false,
        transactionId: `failed_${Date.now()}`,
        riskScore,
        requires3DS,
        message:
          "Payment validation failed: Insufficient funds or invalid card details",
      };
    }

    return {
      valid: true,
      transactionId: `txn_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      authCode: `AUTH${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      riskScore,
      requires3DS,
      message: "Payment validation successful",
    };
  })
  .build();

// External Inventory Fetch Task
export const fetchExternalInventoryTask = r
  .task("remote.tasks.fetchExternalInventory")
  .inputSchema(
    z.object({
      supplierId: z.string(),
      productSkus: z.array(z.string()),
      includePricing: z.boolean().optional().default(true),
      location: z.string().optional(),
    })
  )
  .resultSchema(
    z.object({
      supplierId: z.string(),
      inventory: z.array(
        z.object({
          sku: z.string(),
          available: z.number().int().min(0),
          reserved: z.number().int().min(0),
          price: z.number().positive().optional(),
          currency: z.string().optional(),
          location: z.string().optional(),
          lastUpdated: z.date(),
        })
      ),
      totalAvailable: z.number().int(),
      nextRestock: z.date().optional(),
    })
  )
  .run(async (input) => {
    console.log(
      `Fetching inventory from supplier ${input.supplierId} for ${input.productSkus.length} products`
    );

    // Simulate external API call
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5 second delay

    // Simulate inventory data
    const inventory = input.productSkus.map((sku) => ({
      sku,
      available: Math.floor(Math.random() * 1000),
      reserved: Math.floor(Math.random() * 100),
      price: input.includePricing
        ? Math.floor(Math.random() * 100) + 10
        : undefined,
      currency: input.includePricing ? "USD" : undefined,
      location: input.location || "warehouse-1",
      lastUpdated: new Date(),
    }));

    const totalAvailable = inventory.reduce(
      (sum, item) => sum + item.available,
      0
    );

    return {
      supplierId: input.supplierId,
      inventory,
      totalAvailable,
      nextRestock:
        Math.random() > 0.5
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : undefined,
    };
  })
  .build();

// Heavy Computational Report Generation Task
export const generateReportTask = r
  .task("remote.tasks.generateReport")
  .inputSchema(
    z.object({
      reportType: z.enum(["sales", "inventory", "financial", "analytics"]),
      dateRange: z.object({
        startDate: z.date(),
        endDate: z.date(),
      }),
      format: z.enum(["pdf", "excel", "csv"]).default("pdf"),
      filters: z.record(z.unknown()).optional(),
      includeCharts: z.boolean().optional().default(false),
    })
  )
  .resultSchema(
    z.object({
      reportId: z.string(),
      downloadUrl: z.string(),
      fileSize: z.number(), // bytes
      generatedAt: z.date(),
      expiresAt: z.date(),
      pageCount: z.number().optional(),
      recordCount: z.number(),
    })
  )
  .run(async (input) => {
    console.log(
      `Generating ${input.reportType} report from ${input.dateRange.startDate} to ${input.dateRange.endDate}`
    );

    // Simulate heavy computation
    await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second delay

    const recordCount = Math.floor(Math.random() * 10000) + 1000;
    const fileSize =
      input.format === "pdf" ? recordCount * 1024 : recordCount * 512;
    const pageCount =
      input.format === "pdf" ? Math.ceil(recordCount / 50) : undefined;

    return {
      reportId: `report_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      downloadUrl: `https://reports.example.com/download/report_${Date.now()}.${
        input.format
      }`,
      fileSize,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      pageCount,
      recordCount,
    };
  })
  .build();

// Fraud Detection Task
export const fraudDetectionTask = r
  .task("remote.tasks.fraudDetection")
  .inputSchema(
    z.object({
      userId: z.string(),
      transactionId: z.string(),
      amount: z.number().positive(),
      ipAddress: z.string(),
      userAgent: z.string(),
      billingAddress: z.object({
        country: z.string(),
        zipCode: z.string(),
      }),
      shippingAddress: z
        .object({
          country: z.string(),
          zipCode: z.string(),
        })
        .optional(),
      riskFactors: z.array(z.string()).optional(),
    })
  )
  .resultSchema(
    z.object({
      riskScore: z.number().min(0).max(100),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
      isFraudulent: z.boolean(),
      factors: z.array(
        z.object({
          type: z.string(),
          score: z.number(),
          description: z.string(),
        })
      ),
      recommendation: z.enum(["approve", "manual_review", "decline"]),
      sessionId: z.string(),
    })
  )
  .run(async (input) => {
    console.log(
      `Running fraud detection for transaction ${input.transactionId} amount ${input.amount}`
    );

    // Simulate fraud detection processing
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

    const baseRiskScore = Math.floor(Math.random() * 30);
    const amountRisk =
      input.amount > 1000 ? Math.min(20, input.amount / 100) : 0;
    const locationRisk =
      input.billingAddress.country !== input.shippingAddress?.country ? 15 : 0;
    const totalRiskScore = Math.min(
      100,
      baseRiskScore + amountRisk + locationRisk
    );

    let riskLevel: "low" | "medium" | "high" | "critical";
    let isFraudulent = false;
    let recommendation: "approve" | "manual_review" | "decline";

    if (totalRiskScore < 20) {
      riskLevel = "low";
      recommendation = "approve";
    } else if (totalRiskScore < 50) {
      riskLevel = "medium";
      recommendation = "approve";
    } else if (totalRiskScore < 80) {
      riskLevel = "high";
      recommendation = "manual_review";
    } else {
      riskLevel = "critical";
      isFraudulent = true;
      recommendation = "decline";
    }

    const factors = [];
    if (amountRisk > 0) {
      factors.push({
        type: "high_amount",
        score: amountRisk,
        description: "High transaction amount",
      });
    }
    if (locationRisk > 0) {
      factors.push({
        type: "location_mismatch",
        score: locationRisk,
        description: "Billing and shipping addresses don't match",
      });
    }

    return {
      riskScore: totalRiskScore,
      riskLevel,
      isFraudulent,
      factors,
      recommendation,
      sessionId: `fraud_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    };
  })
  .build();

// ====================
// HTTP EXPOSURE CONFIGURATION
// ====================

export const httpExposure = nodeExposure.with({
  http: {
    basePath: "/__remote-runner",
    listen: {
      host: "0.0.0.0",
      port: 7070,
    },
    auth: {
      token: process.env.REMOTE_RUNNER_TOKEN || "remote_runner_secret_token",
    },
    cors: {
      origin: "*",
      credentials: true,
    },
  },
});

// ====================
// REMOTE SERVER RESOURCE
// ====================

export const remoteServer = r
  .resource("app.remote.server")
  .meta({
    title: "Remote Runner Server",
    description: "HTTP server exposing remote tasks for tunneling",
  })
  .register([
    httpExposure,
    validatePaymentTask,
    fetchExternalInventoryTask,
    generateReportTask,
    fraudDetectionTask,
  ])
  .init(async (_config, _deps) => {
    console.log("🚀 Remote Runner Server starting on port 7070");
    console.log("📡 Available remote tasks:");
    console.log("   - remote.tasks.validatePayment");
    console.log("   - remote.tasks.fetchExternalInventory");
    console.log("   - remote.tasks.generateReport");
    console.log("   - remote.tasks.fraudDetection");
    console.log("🔗 Base URL: http://localhost:7070/__remote-runner");
    return {};
  })
  .build();

// ====================
// SERVER RUNTIME FUNCTION
// ====================

export async function startRemoteServer() {
  const runtime = await run(remoteServer, { debug: "verbose" });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("🛑 Shutting down Remote Runner Server...");
    await runtime.dispose();
    process.exit(0);
  });

  return runtime;
}

// Auto-start if this file is run directly
if (require.main === module) {
  startRemoteServer().catch(console.error);
}
