import {
  Match,
  defineTaskMiddleware,
  defineResource,
  defineTask,
  defineHook,
  defineEvent,
  defineTag,
} from "@bluelibs/runner";
import {
  finiteNumberPattern as finiteNumber,
  integerNumberPattern as integerNumber,
  minimumLengthPattern as minimumLength,
  nonNegativeIntegerPattern as nonNegativeInteger,
  positiveNumberPattern as positiveNumber,
} from "./schemas";

// ====================
// CROSS-CUTTING CONCERNS
// ====================

// Tags for categorization
export const performanceTag = defineTag<{ warnAboveMs: number }>({
  id: "app-tags-performance",
  meta: { title: "xxx yyy" },
  configSchema: Match.compile(
    Match.ObjectIncluding({
      warnAboveMs: Match.PositiveInteger,
    })
  ),
});

export const securityTag = defineTag<{
  requiresAuth: boolean;
  roles?: string[];
}>({
  id: "app-tags-security",
  configSchema: Match.compile(
    Match.ObjectStrict({
      requiresAuth: Boolean,
      roles: Match.Optional([String]),
    })
  ),
});

export const domainTag = defineTag<{ domain: string }>({
  id: "app-tags-domain",
  meta: {
    title: "Domain",
    description: "Tags related to the domain layer",
  },
  configSchema: Match.compile(Match.ObjectIncluding({ domain: String })),
});

export const apiTag = defineTag<{ method: string; path: string }>({
  id: "app-tags-api",
  configSchema: Match.compile(
    Match.ObjectStrict({
      method: Match.OneOf(
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "HEAD"
      ),
      path: String,
    })
  ),
});

// Global middleware
export const validationMiddleware = defineTaskMiddleware<{
  enabled?: boolean;
  mode?: "loose" | "strict";
}>({
  id: "app-middleware-validation",
  meta: {
    title: "Input Validation Middleware",
    description: "Validates task inputs and results using schemas",
  },
  configSchema: Match.compile(
    Match.ObjectStrict({
      enabled: Match.Optional(Boolean),
      mode: Match.Optional(Match.OneOf("loose", "strict")),
    })
  ),
  async run({ task, next }, _evt, _config) {
    // In a real app, you'd validate against task.inputSchema
    return next(task.input);
  },
});

export const loggingMiddleware = defineTaskMiddleware<{
  logLevel?: "debug" | "info" | "warn" | "error";
}>({
  id: "app-middleware-logging",
  meta: {
    title: "Activity Logging Middleware",
    description: "Logs all task executions with performance metrics",
  },
  configSchema: Match.compile(
    Match.ObjectStrict({
      logLevel: Match.Optional(Match.OneOf("debug", "info", "warn", "error")),
    })
  ),
  async run({ task, next }, _evt, _config) {
    const start = Date.now();
    const result = await next(task.input);
    const duration = Date.now() - start;

    console.log(`Task ${task.definition.id} completed in ${duration}ms`);
    return result;
  },
});

export const authMiddleware = defineTaskMiddleware<{ required: boolean }>({
  id: "app-middleware-auth",
  meta: {
    title: "Authentication Middleware",
    description: "Validates user authentication and permissions",
  },
  configSchema: Match.compile(Match.ObjectStrict({ required: Boolean })),
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
export const userRegisteredEvent = defineEvent<{
  userId: string;
  email: string;
  registrationMethod: string;
}>({
  id: "app-users-events-registered",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      userId: String,
      email: Match.Email,
      registrationMethod: String,
    })
  ),
});

export const userLoggedInEvent = defineEvent<{
  userId: string;
  loginMethod: string;
  ipAddress: string;
}>({
  id: "app-users-events-loggedIn",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      userId: String,
      loginMethod: String,
      ipAddress: String,
    })
  ),
});

export const passwordResetRequestedEvent = defineEvent<{
  userId: string;
  email: string;
  resetToken: string;
}>({
  id: "app-users-events-passwordResetRequested",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      userId: String,
      email: Match.Email,
      resetToken: String,
    })
  ),
});

// Resources
export const userDatabaseResource = defineResource({
  id: "app-users-resources-database",
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

export const sessionStoreResource = defineResource({
  id: "app-users-resources-sessionStore",
  meta: {
    title: "Session Store",
    description: "Redis-based session storage",
  },
  configSchema: Match.compile(
    Match.ObjectIncluding({
      ttlSeconds: Match.PositiveInteger,
      redisUrl: Match.URL,
    })
  ),
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
export const registerUserTask = defineTask({
  id: "app-users-tasks-register",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      email: Match.Email,
      password: minimumLength(8),
      firstName: String,
      lastName: String,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectStrict({
      userId: String,
      email: Match.Email,
      verificationToken: String,
    })
  ),
  async run(input: any, { emitUserRegistered }) {
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

export const authenticateUserTask = defineTask({
  id: "app-users-tasks-authenticate",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      email: Match.Email,
      password: String,
      ipAddress: String,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectStrict({
      userId: String,
      sessionToken: String,
      expiresAt: Date,
    })
  ),
  async run(input: any, { emitUserLoggedIn }) {
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

export const requestPasswordResetTask = defineTask({
  id: "app-users-tasks-requestPasswordReset",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      email: Match.Email,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectIncluding({
      success: Boolean,
      resetToken: String,
    })
  ),
  async run(input: any, { emitPasswordResetRequested }) {
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
export const userRegistrationLoggerHook = defineHook({
  id: "app-users-hooks-registrationLogger",
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

export const userLoginLoggerHook = defineHook({
  id: "app-users-hooks-loginLogger",
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
export const productCreatedEvent = defineEvent<{
  productId: string;
  name: string;
  category: string;
  price: number;
}>({
  id: "app-products-events-created",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      productId: String,
      name: String,
      category: String,
      price: positiveNumber,
    })
  ),
});

export const inventoryUpdatedEvent = defineEvent<{
  productId: string;
  oldStock: number;
  newStock: number;
  changeReason: string;
}>({
  id: "app-products-events-inventoryUpdated",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      productId: String,
      oldStock: integerNumber,
      newStock: integerNumber,
      changeReason: String,
    })
  ),
});

export const productOutOfStockEvent = defineEvent<{
  productId: string;
  name: string;
  waitingListCount: number;
}>({
  id: "app-products-events-outOfStock",
  payloadSchema: Match.compile(
    Match.ObjectStrict({
      productId: String,
      name: String,
      waitingListCount: integerNumber,
    })
  ),
});

// Resources
export const productDatabaseResource = defineResource({
  id: "app-products-resources-database",
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

export const inventoryCacheResource = defineResource({
  id: "app-products-resources-inventoryCache",
  meta: {
    title: "Inventory Cache",
    description: "Redis cache for inventory levels",
  },
  configSchema: Match.compile(
    Match.ObjectIncluding({
      ttlSeconds: Match.PositiveInteger,
      redisUrl: Match.URL,
    })
  ),
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
export const createProductTask = defineTask({
  id: "app-products-tasks-create",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      name: Match.NonEmptyString,
      description: String,
      category: String,
      price: positiveNumber,
      initialStock: nonNegativeInteger,
      sku: String,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectStrict({
      productId: String,
      name: String,
      category: String,
      price: finiteNumber,
    })
  ),
  async run(input: any, { emitProductCreated }) {
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

export const updateInventoryTask = defineTask({
  id: "app-products-tasks-updateInventory",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      productId: String,
      newStock: nonNegativeInteger,
      changeReason: String,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectStrict({
      productId: String,
      oldStock: finiteNumber,
      newStock: finiteNumber,
      isOutOfStock: Boolean,
    })
  ),
  async run(input: any, { emitInventoryUpdated, emitOutOfStock }) {
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
export const orderCreatedEvent = defineEvent<{
  orderId: string;
  userId: string;
  totalAmount: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
}>({
  id: "app-orders-events-created",
  payloadSchema: Match.compile(
    Match.ObjectIncluding({
      orderId: String,
      userId: String,
      totalAmount: positiveNumber,
      items: [
        {
          productId: String,
          quantity: Match.PositiveInteger,
          price: positiveNumber,
        },
      ],
    })
  ),
});

export const orderPaidEvent = defineEvent<{
  orderId: string;
  paymentId: string;
  amount: number;
  paymentMethod: string;
}>({
  id: "app-orders-events-paid",
  payloadSchema: Match.compile(
    Match.ObjectIncluding({
      orderId: String,
      paymentId: String,
      amount: positiveNumber,
      paymentMethod: String,
    })
  ),
});

export const orderShippedEvent = defineEvent<{
  orderId: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: Date;
}>({
  id: "app-orders-events-shipped",
  payloadSchema: Match.compile(
    Match.ObjectIncluding({
      orderId: String,
      trackingNumber: String,
      carrier: String,
      estimatedDelivery: Date,
    })
  ),
});

// Resources
export const orderDatabaseResource = defineResource({
  id: "app-orders-resources-database",
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
export const createOrderTask = defineTask({
  id: "app-orders-tasks-create",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      userId: String,
      items: [
        {
          productId: String,
          quantity: Match.PositiveInteger,
        },
      ],
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectIncluding({
      orderId: String,
      totalAmount: finiteNumber,
      status: String,
    })
  ),
  async run(input: any, { emitOrderCreated }) {
    const orderId = `order_${Date.now()}`;
    const totalAmount = input.items.reduce(
      (sum: number, item: any) => sum + item.quantity * 29.99,
      0
    ); // Mock pricing

    console.log(`Creating order ${orderId} for user ${input.userId}`);

    await emitOrderCreated({
      orderId,
      userId: input.userId,
      totalAmount,
      items: input.items.map((item: any) => ({
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

export const processPaymentTask = defineTask({
  id: "app-orders-tasks-processPayment",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      orderId: String,
      paymentMethod: String,
      paymentDetails: {
        cardToken: String,
        amount: positiveNumber,
      },
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectIncluding({
      paymentId: String,
      status: String,
      orderId: String,
    })
  ),
  async run(input: any, { emitOrderPaid }) {
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
export const emailSentEvent = defineEvent<{
  emailId: string;
  to: string;
  template: string;
  metadata: Record<string, any>;
}>({
  id: "app-notifications-events-emailSent",
  payloadSchema: Match.compile(
    Match.ObjectIncluding({
      emailId: String,
      to: Match.Email,
      template: String,
      metadata: Match.MapOf(Match.Any),
    })
  ),
});

export const webhookDeliveredEvent = defineEvent<{
  webhookId: string;
  url: string;
  payload: Record<string, any>;
  statusCode: number;
}>({
  id: "app-notifications-events-webhookDelivered",
  payloadSchema: Match.compile(
    Match.ObjectIncluding({
      webhookId: String,
      url: Match.URL,
      payload: Match.MapOf(Match.Any),
      statusCode: integerNumber,
    })
  ),
});

// Resources
export const emailServiceResource = defineResource({
  id: "app-notifications-resources-emailService",
  meta: {
    title: "Email Service",
    description: "SendGrid email delivery service",
  },
  configSchema: Match.compile(
    Match.ObjectIncluding({
      apiKey: String,
      fromEmail: Match.Email,
      fromName: String,
    })
  ),
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
export const sendWelcomeEmailTask = defineTask({
  id: "app-notifications-tasks-sendWelcomeEmail",
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
  inputSchema: Match.compile(
    Match.ObjectIncluding({
      userId: String,
      email: Match.Email,
      firstName: String,
    })
  ),
  resultSchema: Match.compile(
    Match.ObjectIncluding({
      emailId: String,
      sent: Boolean,
    })
  ),
  async run(input: any, { emitEmailSent }) {
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
export const onProductOutOfStockEventHook = defineHook({
  id: "app-notifications-hooks-onProductOutOfStockEvent",
  on: productOutOfStockEvent,
  dependencies: { sendWelcomeEmail: sendWelcomeEmailTask },
  async run(event, { sendWelcomeEmail: _sendWelcomeEmail }) {
    console.log(`Product out of stock: ${event.data.productId}`);
  },
});

export const multiHookEvent = defineHook({
  id: "app-notifications-hooks-multiHookEvent",
  on: [userRegisteredEvent, productOutOfStockEvent],
  dependencies: { sendWelcomeEmail: sendWelcomeEmailTask },
  async run(event, { sendWelcomeEmail: _sendWelcomeEmail }) {
    console.log(`Multi-hook event: ${event.id}`);
  },
});

export const welcomeEmailOnRegistrationHook = defineHook({
  id: "app-notifications-hooks-welcomeOnRegistration",
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
    await (sendWelcomeEmail as any)({
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
export const analyticsDatabaseResource = defineResource({
  id: "app-analytics-resources-database",
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
export const analyticsGlobalHook = defineHook({
  id: "app-analytics-hooks-globalTracker",
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

export const orderAnalyticsHook = defineHook({
  id: "app-analytics-hooks-orderTracker",
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
  return defineResource({
    id: "dummy-superapp",
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
