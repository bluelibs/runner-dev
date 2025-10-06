# Enhanced Dummy Super App

This enhanced dummy application demonstrates the advanced features of BlueLibs Runner, including error handling with fluent builders, async context propagation, tunneling to remote services, and comprehensive business domain modeling.

## 📁 Folder Structure

```
enhanced/
├── errors/          # Domain-specific error definitions using fluent builders
├── contexts/        # Async context resources with middleware
├── tunneling/       # HTTP tunneling server and client examples
├── domains/         # Enhanced business domains using new features
├── examples/        # Integration examples and demonstrations
└── index.ts         # Main entry point and quick start functions
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { startEnhancedDemo } from "./enhanced";

// Start the full demo application
const runtime = await startEnhancedDemo();
```

### Individual Demos

```typescript
import {
  quickErrorDemo,
  quickContextDemo,
  quickTunnelingDemo,
  runAllDemos
} from "./enhanced";

// Run specific demos
await quickErrorDemo();           // Error handling patterns
await quickContextDemo();         // Context propagation
await quickTunnelingDemo();       // Remote task tunneling
await runAllDemos();              // All demos in sequence
```

## 🔧 Features Demonstrated

### 1. Error Handling with Fluent Builders

Domain-specific errors using the `r.error<DataType>(id)` pattern:

```typescript
const UserNotFoundError = r
  .error<{ userId: string; message: string }>("app.users.errors.userNotFound")
  .dataSchema(z.object({
    userId: z.string(),
    message: z.string(),
  }))
  .build();

// Usage
UserNotFoundError.throw({
  userId: "123",
  message: "User not found"
});
```

**Available Error Types:**
- **User Domain**: `UserNotFoundError`, `InvalidCredentialsError`, `EmailAlreadyExistsError`, `AccountLockedError`
- **Product Domain**: `ProductNotFoundError`, `InsufficientStockError`, `InvalidPriceError`, `CategoryNotFoundError`
- **Order Domain**: `PaymentFailedError`, `OrderNotFoundError`, `InvalidOrderStatusError`, `OrderExpiredError`
- **System**: `DatabaseConnectionError`, `ServiceUnavailableError`, `RateLimitExceededError`, `ValidationError`

### 2. Async Context Propagation

Request-scoped context propagation using `r.asyncContext<ContextType>(id)`:

```typescript
const RequestContext = r
  .asyncContext<{
    requestId: string;
    userId?: string;
    timestamp: Date;
  }>("app.contexts.request")
  .serialize((data) => JSON.stringify(data))
  .parse((raw) => JSON.parse(raw))
  .build();

// Usage
await RequestContext.provide({
  requestId: "req_123",
  userId: "user_456",
  timestamp: new Date()
}, async () => {
  // Context is available throughout this async boundary
  const context = RequestContext.use();
  console.log(context.requestId); // "req_123"
});
```

**Available Contexts:**
- **RequestContext**: Request tracking, user ID, session info
- **AuditContext**: Trace IDs, operation tracking, metadata
- **SecurityContext**: Authentication, permissions, roles
- **TenantContext**: Multi-tenant configuration
- **BusinessContext**: Business unit, region, channel info
- **PerformanceContext**: Performance checkpoints, metrics
- **CacheContext**: Caching strategies and hit tracking

### 3. HTTP Tunneling

Remote task execution via HTTP tunnels:

```typescript
// Remote server (port 7070)
const serverRuntime = await startRemoteServer();

// Tunnel client
const clientRuntime = await startTunnelClient();

// Use remote tasks via tunnel
const result = await clientRuntime.runTask(enhancedProcessOrderTask, {
  orderId: "order_123",
  // ... order data
});
```

**Remote Tasks Available:**
- `remote.tasks.validatePayment` - Payment gateway validation
- `remote.tasks.fetchExternalInventory` - Supplier inventory sync
- `remote.tasks.generateReport` - Heavy computational report generation
- `remote.tasks.fraudDetection` - Real-time fraud analysis

### 4. Enhanced Business Domains

#### User Management
- Enhanced registration with fraud detection
- Comprehensive authentication with security assessment
- Account lockout and suspicious activity monitoring
- Multi-factor authentication support

#### Product Management
- Dynamic pricing with tenant and business context
- Real-time inventory management across locations
- Supplier integration via tunneling
- Category and attribute validation

#### Order Processing
- Payment processing with remote gateway integration
- Fraud detection and risk assessment
- Multi-step order workflow
- Error recovery and retry mechanisms

## 📊 Integration Examples

### Complete User Journey

```typescript
const journeyResult = await runtime.runTask(completeUserJourneyTask, {
  userRegistration: {
    email: "user@example.com",
    password: "SecurePassword123!",
    firstName: "John",
    lastName: "Doe",
    ipAddress: "192.168.1.100",
    userAgent: "Demo Browser"
  },
  productCreation: {
    name: "Demo Product",
    category: "electronics",
    basePrice: 99.99,
    initialStock: 100
  },
  orderPlacement: {
    items: [{ productId: "demo", quantity: 2 }],
    paymentMethod: "credit_card"
  },
  businessContext: {
    tenantId: "tenant_001",
    businessUnit: "ecommerce",
    region: "US",
    channel: "web"
  }
});
```

### Error Handling Demonstration

```typescript
const errorResults = await runtime.runTask(errorHandlingDemoTask, {
  scenarios: [
    "validation_error",
    "user_not_found",
    "insufficient_stock",
    "payment_failed",
    "rate_limit"
  ]
});
```

### Context Propagation Demo

```typescript
const contextResults = await runtime.runTask(contextPropagationDemoTask, {
  enableNestedTasks: true,
  enableContextModification: true
});
```

## 🛠️ Development

### Running Tests

```bash
# Run all demos
npm run demo:enhanced

# Run specific demo
npm run demo:errors
npm run demo:contexts
npm run demo:tunneling
npm run demo:integration
```

### Environment Variables

```bash
# Tunneling configuration
REMOTE_RUNNER_URL=http://localhost:7070/__remote-runner
REMOTE_RUNNER_TOKEN=your_secret_token

# Demo configuration
DEBUG=verbose
DEMO_MODE=full
```

### Project Structure

- **`errors/`** - All error definitions organized by domain
- **`contexts/`** - Async context resources and middleware
- **`tunneling/`** - Server/client tunneling implementation
- **`domains/`** - Enhanced business domain implementations
- **`examples/`** - Integration examples and demo scenarios
- **`index.ts`** - Main entry point and convenience functions

## 🎯 Key Concepts Demonstrated

1. **Fluent Error Builders**: Type-safe error creation with validation
2. **Async Context Propagation**: Request-scoped data across async boundaries
3. **Performance Monitoring**: Built-in performance checkpoints and metrics
4. **Multi-tenant Support**: Tenant-aware resources and contexts
5. **Business Domain Separation**: Clean architecture with domain boundaries
6. **Remote Task Execution**: HTTP tunneling for distributed systems
7. **Comprehensive Error Handling**: Graceful degradation and recovery
8. **Context-Aware Middleware**: Context injection and validation
9. **Event-Driven Architecture**: Domain events and hooks
10. **Integration Patterns**: Real-world e-commerce scenarios

## 📚 Next Steps

1. **Explore Error Handling**: Try the `quickErrorDemo()` function
2. **Test Context Propagation**: Run `quickContextDemo()` to see context flow
3. **Set Up Tunneling**: Start remote server with `startRemoteServer()`
4. **Run Integration Demo**: Execute `runIntegrationDemo()` for the full experience
5. **Customize Domains**: Modify business domains for your use case
6. **Add New Contexts**: Create custom async contexts for your application
7. **Extend Tunneling**: Add new remote tasks and services

This enhanced dummy app serves as a comprehensive reference implementation for advanced Runner features and real-world application patterns.