import {
  taskMiddleware,
  resource,
  task,
  hook,
  event,
  tag,
  resourceMiddleware,
  globals,
} from "@bluelibs/runner";
import { z } from "zod";

// ====================
// CROSS-CUTTING CONCERNS
// ====================

// Tags for categorization
export const performanceTag = tag<{ warnAboveMs: number }>({
  id: "app.tags.performance",
  meta: { title: "xxx yyy" },
});

export const securityTag = tag<{ requiresAuth: boolean; roles?: string[] }>({
  id: "app.tags.security",
});

export const domainTag = tag<{ domain: string }>({
  id: "app.tags.domain",
  configSchema: z.object({ domain: z.string() }),
});

export const apiTag = tag<{ method: string; path: string }>({
  id: "app.tags.api",
});

// Global middleware
export const validationMiddleware = taskMiddleware({
  id: "app.middleware.validation",
  meta: {
    title: "Input Validation Middleware",
    description: "Validates task inputs and results using schemas",
  },
  async run({ task, next }) {
    // In a real app, you'd validate against task.inputSchema
    return next(task.input);
  },
});


export const loggingMiddleware = taskMiddleware({
  id: "app.middleware.logging",
  meta: {
    title: "Activity Logging Middleware",
    description: "Logs all task executions with performance metrics",
  },
  async run({ task, next }) {
    const start = Date.now();
    const result = await next(task.input);
    const duration = Date.now() - start;

    console.log(`Task ${task.definition.id} completed in ${duration}ms`);
    return result;
  },
});

export const authMiddleware = taskMiddleware<{ required: boolean }>({
  id: "app.middleware.auth",
  meta: {
    title: "Authentication Middleware",
    description: "Validates user authentication and permissions",
  },
  configSchema: z.object({ required: z.boolean() }).strict(),
  async run({ task, next }, _, config) {
    if (config.required) {
      // In a real app, check for valid session/token
      console.log(`Auth check for task: ${task.definition.id}`);
    }
    return next(task.input);
  },
});

// ====================
// USER MANAGEMENT DOMAIN
// ====================

// Events
export const userRegisteredEvent = event<{
  userId: string;
  email: string;
  registrationMethod: string;
}>({
  id: "app.users.events.registered",
  payloadSchema: z
    .object({
      userId: z.string(),
      email: z.string().email(),
      registrationMethod: z.string(),
    })
    .strict(),
});

export const userLoggedInEvent = event<{
  userId: string;
  loginMethod: string;
  ipAddress: string;
}>({
  id: "app.users.events.loggedIn",
  payloadSchema: z
    .object({
      userId: z.string(),
      loginMethod: z.string(),
      ipAddress: z.string(),
    })
    .strict(),
});

export const passwordResetRequestedEvent = event<{
  userId: string;
  email: string;
  resetToken: string;
}>({
  id: "app.users.events.passwordResetRequested",
  payloadSchema: z
    .object({
      userId: z.string(),
      email: z.string().email(),
      resetToken: z.string(),
    })
    .strict(),
});

// Resources
export const userDatabaseResource = resource({
  id: "app.users.resources.database",
  meta: {
    title: "User Database",
    description: "PostgreSQL database for user data",
  },
  tags: [domainTag.with({ domain: "users" })],
  async init() {
    return {
      connectionString: "postgresql://localhost:5432/users",
      pool: { min: 2, max: 10 },
    };
  },
});

export const sessionStoreResource = resource({
  id: "app.users.resources.sessionStore",
  meta: {
    title: "Session Store",
    description: "Redis-based session storage",
  },
  configSchema: z.object({
    ttlSeconds: z.number().int().positive(),
    redisUrl: z.string().url(),
  }),
  tags: [domainTag.with({ domain: "users" })],
  async init(config: { ttlSeconds: number; redisUrl: string }) {
    return {
      ttl: config.ttlSeconds,
      redisUrl: config.redisUrl,
      connected: true,
    };
  },
});

// Tasks
export const registerUserTask = task({
  id: "app.users.tasks.register",
  dependencies: () => ({
    db: userDatabaseResource,
    emitUserRegistered: userRegisteredEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: false }),
  ],
  meta: {
    title: "Register New User",
    description: "Creates a new user account with email verification",
  },
  tags: [
    domainTag.with({ domain: "users" }),
    apiTag.with({ method: "POST", path: "/api/users/register" }),
    securityTag.with({ requiresAuth: false }),
  ],
  inputSchema: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string(),
    lastName: z.string(),
  }),
  resultSchema: z
    .object({
      userId: z.string(),
      email: z.string().email(),
      verificationToken: z.string(),
    })
    .strict(),
  async run(input, { emitUserRegistered }) {
    // Simulate user creation
    const userId = `user_${Date.now()}`;
    const verificationToken = `verify_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // In a real app, you'd hash password, save to DB, etc.
    console.log(`Registering user: ${input.email}`);

    await emitUserRegistered({
      userId,
      email: input.email,
      registrationMethod: "email",
    });

    return {
      userId,
      email: input.email,
      verificationToken,
    };
  },
});

export const authenticateUserTask = task({
  id: "app.users.tasks.authenticate",
  dependencies: () => ({
    db: userDatabaseResource,
    sessionStore: sessionStoreResource,
    emitUserLoggedIn: userLoggedInEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: false }),
  ],
  meta: {
    title: "Authenticate User",
    description: "Validates credentials and creates session",
  },
  tags: [
    domainTag.with({ domain: "users" }),
    apiTag.with({ method: "POST", path: "/api/users/login" }),
    securityTag.with({ requiresAuth: false }),
  ],
  inputSchema: z.object({
    email: z.string().email(),
    password: z.string(),
    ipAddress: z.string(),
  }),
  resultSchema: z
    .object({
      userId: z.string(),
      sessionToken: z.string(),
      expiresAt: z.date(),
    })
    .strict(),
  async run(input, { emitUserLoggedIn }) {
    // Simulate authentication
    const userId = `user_${Date.now()}`;
    const sessionToken = `session_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Authenticating user: ${input.email}`);

    await emitUserLoggedIn({
      userId,
      loginMethod: "password",
      ipAddress: input.ipAddress,
    });

    return {
      userId,
      sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
  },
});

export const requestPasswordResetTask = task({
  id: "app.users.tasks.requestPasswordReset",
  dependencies: () => ({
    db: userDatabaseResource,
    emitPasswordResetRequested: passwordResetRequestedEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: false }),
  ],
  meta: {
    title: "Request Password Reset",
    description: "Initiates password reset flow for user",
  },
  tags: [
    domainTag.with({ domain: "users" }),
    apiTag.with({ method: "POST", path: "/api/users/forgot-password" }),
    securityTag.with({ requiresAuth: false }),
  ],
  inputSchema: z.object({
    email: z.string().email(),
  }),
  resultSchema: z.object({
    success: z.boolean(),
    resetToken: z.string(),
  }),
  async run(input, { emitPasswordResetRequested }) {
    const resetToken = `reset_${Math.random().toString(36).substr(2, 9)}`;
    const userId = `user_lookup_${input.email}`;

    console.log(`Password reset requested for: ${input.email}`);

    await emitPasswordResetRequested({
      userId,
      email: input.email,
      resetToken,
    });

    return {
      success: true,
      resetToken,
    };
  },
});

// Hooks
export const userRegistrationLoggerHook = hook({
  id: "app.users.hooks.registrationLogger",
  on: userRegisteredEvent,
  dependencies: { db: userDatabaseResource },
  meta: {
    title: "User Registration Logger",
    description: "Logs user registration activities for audit",
  },
  tags: [domainTag.with({ domain: "users" })],
  async run(event) {
    console.log(
      `User registration: ${event.data.email} with method ${event.data.registrationMethod}`
    );
    // In a real app, save to audit log
  },
});

export const userLoginLoggerHook = hook({
  id: "app.users.hooks.loginLogger",
  on: userLoggedInEvent,
  dependencies: { db: userDatabaseResource },
  meta: {
    title: "User Login Logger",
    description: "Logs user login activities for audit",
  },
  tags: [domainTag.with({ domain: "users" })],
  async run(event) {
    console.log(
      `User login: ${event.data.userId} from ${event.data.ipAddress}`
    );
    // In a real app, save to audit log
  },
});

// ====================
// PRODUCT MANAGEMENT DOMAIN
// ====================

// Events
export const productCreatedEvent = event<{
  productId: string;
  name: string;
  category: string;
  price: number;
}>({
  id: "app.products.events.created",
  payloadSchema: z
    .object({
      productId: z.string(),
      name: z.string(),
      category: z.string(),
      price: z.number().positive(),
    })
    .strict(),
});

export const inventoryUpdatedEvent = event<{
  productId: string;
  oldStock: number;
  newStock: number;
  changeReason: string;
}>({
  id: "app.products.events.inventoryUpdated",
  payloadSchema: z
    .object({
      productId: z.string(),
      oldStock: z.number().int(),
      newStock: z.number().int(),
      changeReason: z.string(),
    })
    .strict(),
});

export const productOutOfStockEvent = event<{
  productId: string;
  name: string;
  waitingListCount: number;
}>({
  id: "app.products.events.outOfStock",
  payloadSchema: z
    .object({
      productId: z.string(),
      name: z.string(),
      waitingListCount: z.number().int(),
    })
    .strict(),
});

// Resources
export const productDatabaseResource = resource({
  id: "app.products.resources.database",
  meta: {
    title: "Product Database",
    description: "Database for product catalog and inventory",
  },
  tags: [domainTag.with({ domain: "products" })],
  async init() {
    return {
      connectionString: "postgresql://localhost:5432/products",
      searchIndex: "elasticsearch://localhost:9200/products",
    };
  },
});

export const inventoryCacheResource = resource({
  id: "app.products.resources.inventoryCache",
  meta: {
    title: "Inventory Cache",
    description: "Redis cache for inventory levels",
  },
  configSchema: z.object({
    ttlSeconds: z.number().int().positive(),
    redisUrl: z.string().url(),
  }),
  tags: [domainTag.with({ domain: "products" })],
  async init(config: { ttlSeconds: number; redisUrl: string }) {
    return {
      ttl: config.ttlSeconds,
      redisUrl: config.redisUrl,
      connected: true,
    };
  },
});

// Tasks
export const createProductTask = task({
  id: "app.products.tasks.create",
  dependencies: () => ({
    db: productDatabaseResource,
    emitProductCreated: productCreatedEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: true }),
  ],
  meta: {
    title: "Create Product",
    description: "Adds a new product to the catalog",
  },
  tags: [
    domainTag.with({ domain: "products" }),
    apiTag.with({ method: "POST", path: "/api/products" }),
    securityTag.with({ requiresAuth: true, roles: ["admin", "merchant"] }),
  ],
  inputSchema: z.object({
    name: z.string().min(1),
    description: z.string(),
    category: z.string(),
    price: z.number().positive(),
    initialStock: z.number().int().min(0),
    sku: z.string(),
  }),
  resultSchema: z
    .object({
      productId: z.string(),
      name: z.string(),
      category: z.string(),
      price: z.number(),
    })
    .strict(),
  async run(input, { emitProductCreated }) {
    const productId = `product_${Date.now()}`;

    console.log(`Creating product: ${input.name}`);

    await emitProductCreated({
      productId,
      name: input.name,
      category: input.category,
      price: input.price,
    });

    return {
      productId,
      name: input.name,
      category: input.category,
      price: input.price,
    };
  },
});

export const updateInventoryTask = task({
  id: "app.products.tasks.updateInventory",
  dependencies: () => ({
    db: productDatabaseResource,
    cache: inventoryCacheResource,
    emitInventoryUpdated: inventoryUpdatedEvent,
    emitOutOfStock: productOutOfStockEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: true }),
  ],
  meta: {
    title: "Update Inventory",
    description: "Updates stock levels and triggers out-of-stock events",
  },
  tags: [
    domainTag.with({ domain: "products" }),
    apiTag.with({ method: "PATCH", path: "/api/products/{id}/inventory" }),
    securityTag.with({ requiresAuth: true, roles: ["admin", "merchant"] }),
  ],
  inputSchema: z.object({
    productId: z.string(),
    newStock: z.number().int().min(0),
    changeReason: z.string(),
  }),
  resultSchema: z
    .object({
      productId: z.string(),
      oldStock: z.number(),
      newStock: z.number(),
      isOutOfStock: z.boolean(),
    })
    .strict(),
  async run(input, { emitInventoryUpdated, emitOutOfStock }) {
    const oldStock = Math.floor(Math.random() * 100); // Simulate DB lookup

    console.log(
      `Updating inventory for product ${input.productId}: ${oldStock} -> ${input.newStock}`
    );

    await emitInventoryUpdated({
      productId: input.productId,
      oldStock,
      newStock: input.newStock,
      changeReason: input.changeReason,
    });

    if (input.newStock === 0) {
      await emitOutOfStock({
        productId: input.productId,
        name: `Product ${input.productId}`, // In real app, lookup name
        waitingListCount: 0,
      });
    }

    return {
      productId: input.productId,
      oldStock,
      newStock: input.newStock,
      isOutOfStock: input.newStock === 0,
    };
  },
});

// ====================
// ORDER PROCESSING DOMAIN
// ====================

// Events
export const orderCreatedEvent = event<{
  orderId: string;
  userId: string;
  totalAmount: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
}>({
  id: "app.orders.events.created",
  payloadSchema: z.object({
    orderId: z.string(),
    userId: z.string(),
    totalAmount: z.number().positive(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
  }),
});

export const orderPaidEvent = event<{
  orderId: string;
  paymentId: string;
  amount: number;
  paymentMethod: string;
}>({
  id: "app.orders.events.paid",
  payloadSchema: z.object({
    orderId: z.string(),
    paymentId: z.string(),
    amount: z.number().positive(),
    paymentMethod: z.string(),
  }),
});

export const orderShippedEvent = event<{
  orderId: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: Date;
}>({
  id: "app.orders.events.shipped",
  payloadSchema: z.object({
    orderId: z.string(),
    trackingNumber: z.string(),
    carrier: z.string(),
    estimatedDelivery: z.date(),
  }),
});

// Resources
export const orderDatabaseResource = resource({
  id: "app.orders.resources.database",
  meta: {
    title: "Order Database",
    description: "Database for orders and fulfillment",
  },
  tags: [domainTag.with({ domain: "orders" })],
  async init() {
    return {
      connectionString: "postgresql://localhost:5432/orders",
      readReplica: "postgresql://replica:5432/orders",
    };
  },
});

// Tasks
export const createOrderTask = task({
  id: "app.orders.tasks.create",
  dependencies: () => ({
    db: orderDatabaseResource,
    productDb: productDatabaseResource,
    emitOrderCreated: orderCreatedEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: true }),
  ],
  meta: {
    title: "Create Order",
    description: "Creates a new order from cart items",
  },
  tags: [
    domainTag.with({ domain: "orders" }),
    apiTag.with({ method: "POST", path: "/api/orders" }),
    securityTag.with({ requiresAuth: true }),
  ],
  inputSchema: z.object({
    userId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })
    ),
  }),
  resultSchema: z.object({
    orderId: z.string(),
    totalAmount: z.number(),
    status: z.string(),
  }),
  async run(input, { emitOrderCreated }) {
    const orderId = `order_${Date.now()}`;
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.quantity * 29.99,
      0
    ); // Mock pricing

    console.log(`Creating order ${orderId} for user ${input.userId}`);

    await emitOrderCreated({
      orderId,
      userId: input.userId,
      totalAmount,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: 29.99, // Mock price
      })),
    });

    return {
      orderId,
      totalAmount,
      status: "pending",
    };
  },
});

export const processPaymentTask = task({
  id: "app.orders.tasks.processPayment",
  dependencies: () => ({
    db: orderDatabaseResource,
    emitOrderPaid: orderPaidEvent,
  }),
  middleware: [
    validationMiddleware,
    loggingMiddleware,
    authMiddleware.with({ required: true }),
  ],
  meta: {
    title: "Process Payment",
    description: "Processes payment for an order",
  },
  tags: [
    domainTag.with({ domain: "orders" }),
    apiTag.with({ method: "POST", path: "/api/orders/{id}/payment" }),
    securityTag.with({ requiresAuth: true }),
  ],
  inputSchema: z.object({
    orderId: z.string(),
    paymentMethod: z.string(),
    paymentDetails: z.object({
      cardToken: z.string(),
      amount: z.number().positive(),
    }),
  }),
  resultSchema: z.object({
    paymentId: z.string(),
    status: z.string(),
    orderId: z.string(),
  }),
  async run(input, { emitOrderPaid }) {
    const paymentId = `payment_${Date.now()}`;

    console.log(`Processing payment for order ${input.orderId}`);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    await emitOrderPaid({
      orderId: input.orderId,
      paymentId,
      amount: input.paymentDetails.amount,
      paymentMethod: input.paymentMethod,
    });

    return {
      paymentId,
      status: "completed",
      orderId: input.orderId,
    };
  },
});

// ====================
// NOTIFICATION SYSTEM
// ====================

// Events
export const emailSentEvent = event<{
  emailId: string;
  to: string;
  template: string;
  metadata: Record<string, any>;
}>({
  id: "app.notifications.events.emailSent",
  payloadSchema: z.object({
    emailId: z.string(),
    to: z.string().email(),
    template: z.string(),
    metadata: z.record(z.any()),
  }),
});

export const webhookDeliveredEvent = event<{
  webhookId: string;
  url: string;
  payload: Record<string, any>;
  statusCode: number;
}>({
  id: "app.notifications.events.webhookDelivered",
  payloadSchema: z.object({
    webhookId: z.string(),
    url: z.string().url(),
    payload: z.record(z.any()),
    statusCode: z.number().int(),
  }),
});

// Resources
export const emailServiceResource = resource({
  id: "app.notifications.resources.emailService",
  meta: {
    title: "Email Service",
    description: "SendGrid email delivery service",
  },
  configSchema: z.object({
    apiKey: z.string(),
    fromEmail: z.string().email(),
    fromName: z.string(),
  }),
  tags: [domainTag.with({ domain: "notifications" })],
  async init(config: { apiKey: string; fromEmail: string; fromName: string }) {
    return {
      apiKey: config.apiKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      connected: true,
    };
  },
});

// Tasks
export const sendWelcomeEmailTask = task({
  id: "app.notifications.tasks.sendWelcomeEmail",
  dependencies: () => ({
    emailService: emailServiceResource,
    emitEmailSent: emailSentEvent,
  }),
  middleware: [validationMiddleware, loggingMiddleware],
  meta: {
    title: "Send Welcome Email",
    description: "Sends welcome email to new users",
  },
  tags: [
    domainTag.with({ domain: "notifications" }),
    apiTag.with({ method: "POST", path: "/api/notifications/welcome-email" }),
  ],
  inputSchema: z.object({
    userId: z.string(),
    email: z.string().email(),
    firstName: z.string(),
  }),
  resultSchema: z.object({
    emailId: z.string(),
    sent: z.boolean(),
  }),
  async run(input, { emitEmailSent }) {
    const emailId = `email_${Date.now()}`;

    console.log(`Sending welcome email to ${input.email}`);

    await emitEmailSent({
      emailId,
      to: input.email,
      template: "welcome",
      metadata: { userId: input.userId, firstName: input.firstName },
    });

    return {
      emailId,
      sent: true,
    };
  },
});

// Hooks - Cross-domain event handlers
export const onProductOutOfStockEventHook = hook({
  id: "app.notifications.hooks.onProductOutOfStockEvent",
  on: productOutOfStockEvent,
  dependencies: { sendWelcomeEmail: sendWelcomeEmailTask },
  async run(event, { sendWelcomeEmail }) {
    console.log(`Product out of stock: ${event.data.productId}`);
  },
});

export const multiHookEvent = hook({
  id: "app.notifications.hooks.multiHookEvent",
  on: [userRegisteredEvent, productOutOfStockEvent],
  dependencies: { sendWelcomeEmail: sendWelcomeEmailTask },
  async run(event, { sendWelcomeEmail }) {
    console.log(`Multi-hook event: ${event.id}`);
  },
});

export const welcomeEmailOnRegistrationHook = hook({
  id: "app.notifications.hooks.welcomeOnRegistration",
  on: userRegisteredEvent,
  dependencies: { sendWelcomeEmail: sendWelcomeEmailTask },
  meta: {
    title: "Send Welcome Email on Registration",
    description: "Automatically sends welcome email when user registers",
  },
  tags: [domainTag.with({ domain: "notifications" })],
  async run(event, { sendWelcomeEmail }) {
    console.log(`Triggering welcome email for new user: ${event.data.email}`);

    // In a real app, you'd get user details from DB
    await sendWelcomeEmail({
      userId: event.data.userId,
      email: event.data.email,
      firstName: "New User", // Would look up from DB
    });
  },
});

// ====================
// ANALYTICS SYSTEM
// ====================

// Resources
export const analyticsDatabaseResource = resource({
  id: "app.analytics.resources.database",
  meta: {
    title: "Analytics Database",
    description: "ClickHouse analytics database",
  },
  tags: [domainTag.with({ domain: "analytics" })],
  async init() {
    return {
      connectionString: "clickhouse://localhost:8123/analytics",
      cluster: "analytics_cluster",
    };
  },
});

// Global hooks for analytics
export const analyticsGlobalHook = hook({
  id: "app.analytics.hooks.globalTracker",
  on: "*", // Listen to all events
  dependencies: { analyticsDb: analyticsDatabaseResource },
  meta: {
    title: "Global Analytics Tracker",
    description: "Tracks all system events for analytics",
  },
  tags: [domainTag.with({ domain: "analytics" })],
  async run(event) {
    console.log(
      `Analytics: Event ${event.id} occurred at ${new Date().toISOString()}`
    );
    // In a real app, save to analytics DB
  },
});

export const orderAnalyticsHook = hook({
  id: "app.analytics.hooks.orderTracker",
  on: orderCreatedEvent,
  dependencies: { analyticsDb: analyticsDatabaseResource },
  meta: {
    title: "Order Analytics Tracker",
    description: "Tracks order lifecycle events",
  },
  tags: [domainTag.with({ domain: "analytics" })],
  async run(event) {
    console.log(`Order Analytics: ${event.id} - Order ${event.data.orderId}`);
  },
});

// ====================
// MAIN APPLICATION
// ====================

export function createDummySuperApp(extra: any[] = []) {
  return resource({
    id: "dummy.superapp",
    meta: {
      title: "E-Commerce Super App",
      description:
        "Comprehensive e-commerce application with multiple domains and flows",
    },
    register: [
      // Cross-cutting concerns
      validationMiddleware,
      loggingMiddleware,
      authMiddleware,

      // Tags
      performanceTag,
      securityTag,
      domainTag,
      apiTag,

      // User Management
      userDatabaseResource,
      sessionStoreResource.with({
        ttlSeconds: 86400, // 24 hours
        redisUrl: "redis://localhost:6379",
      }),
      registerUserTask,
      authenticateUserTask,
      requestPasswordResetTask,
      userRegisteredEvent,
      userLoggedInEvent,
      passwordResetRequestedEvent,
      userRegistrationLoggerHook,
      userLoginLoggerHook,

      // Product Management
      productDatabaseResource,
      inventoryCacheResource.with({
        ttlSeconds: 300, // 5 minutes
        redisUrl: "redis://localhost:6379",
      }),
      createProductTask,
      updateInventoryTask,
      productCreatedEvent,
      inventoryUpdatedEvent,
      productOutOfStockEvent,
      onProductOutOfStockEventHook,
      multiHookEvent,

      // Order Processing
      orderDatabaseResource,
      createOrderTask,
      processPaymentTask,
      orderCreatedEvent,
      orderPaidEvent,
      orderShippedEvent,

      // Notifications
      emailServiceResource.with({
        apiKey: "sendgrid_api_key",
        fromEmail: "noreply@ecommerce.com",
        fromName: "E-Commerce Team",
      }),
      sendWelcomeEmailTask,
      emailSentEvent,
      webhookDeliveredEvent,
      welcomeEmailOnRegistrationHook,

      // Analytics
      analyticsDatabaseResource,
      analyticsGlobalHook,
      orderAnalyticsHook,

      // Extra registrations
      ...extra,
    ],
    dependencies: {},
  });
}
